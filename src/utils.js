const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');

const hx = require('hbuilderx');
const spawn = require('cross-spawn')

const git = require('simple-git');
// const git = simpleGit();

/**
 * @description 背景颜色、输入框颜色、字体颜色、线条颜色
 */
function getThemeColor() {
    let config = hx.workspace.getConfiguration();
    let colorScheme = config.get('editor.colorScheme');

    // 背景颜色、输入框颜色、字体颜色、线条颜色
    let background, liHoverBackground,inputColor, inputLineColor, cursorColor, fontColor, lineColor, menuBackground;

    if (colorScheme == 'Monokai') {
        background = 'rgb(39,40,34)';
        inputColor = 'rgb(255,254,250)';
        inputLineColor = 'rgb(210,210,210)';
        cursorColor = 'rgb(255,255,255)';
        fontColor = 'rgb(179,182,166)';
        lineColor = 'rgb(23,23,23)';
        liHoverBackground = 'rgb(78,80,73)';
        menuBackground = 'rgb(83,83,83)';
    } else if (colorScheme == 'Atom One Dark') {
        background = 'rgb(40,44,53)';
        inputColor = 'rgb(255,254,250)';
        inputLineColor = 'rgb(81,140,255)';
        cursorColor = 'rgb(255,255,255)';
        fontColor = 'rgb(171,178,191)';
        lineColor = 'rgb(33,37,43)';
        liHoverBackground = 'rgb(44,47,55)';
        menuBackground = 'rgb(50,56,66)';
    } else {
        background = 'rgb(255,250,232)';
        inputColor = 'rgb(255,252,243)';
        inputLineColor = 'rgb(65,168,99)';
        cursorColor = 'rgb(0,0,0)';
        fontColor = '#333';
        lineColor = 'rgb(225,212,178)';
        liHoverBackground = 'rgb(224,237,211)';
        menuBackground = 'rgb(255,252,243)';
    };
    return {
        background,
        menuBackground,
        liHoverBackground,
        inputColor,
        inputLineColor,
        cursorColor,
        fontColor,
        lineColor
    };
};

/**
 * @description 获取项目管理器的项目数量
 */
async function getFilesExplorerProjectInfo() {
    let data = {
        "success": true,
        "msg": '',
        "FoldersNum": 0,
        "Folders": []
    };
    let result = hx.workspace.getWorkspaceFolders().then(function(wsFolders) {
        try{
            let Folders = []
            for (let item of wsFolders) {
                let tmp = {
                    'FolderPath': item.uri.fsPath,
                    'FolderName': item.name,
                    'isGit': false
                };
                let gitfsPath = path.join(item.uri.fsPath, '.git', 'config');
                if (fs.existsSync(gitfsPath)) {
                    tmp.isGit = true;
                };
                Folders.push(tmp);
            };
            data.FoldersNum = wsFolders.length;
            data.Folders = Folders;
        } catch (e) {
            data.msg = "获取项目管理器项目信息失败";
            data.success = false;
        };
        return data;
    });
    return result;
};


/**
 * @description 创建输出控制台
 */
function createOutputChannel(label,msg) {
    let channel_name = "Git";
    let outputChannel = hx.window.createOutputChannel(channel_name);
    outputChannel.show();
    outputChannel.appendLine(label);

    let text = `${msg}`;
    outputChannel.appendLine('\n\n' + text);
};


/**
 * @description 运行命令
 */
async function runCmd(cmd) {
    let label = '执行:' + cmd + '\n';
    exec(cmd, function(error, stdout, stderr) {
        createOutputChannel(label,[stdout,stderr]);
    });
};


/**
 * @description 获取git信息
 * @param {Object} projectPath
 */
async function gitInit(projectPath,projectName) {
    try{
        let status = await git(projectPath).init()
            .then(() => {
                hx.window.showInformationMessage(`项目【${projectName}】初始化Git存储库成功！`,['好的']);
                return 'success'
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 项目【${projectName}】 初始化Git存储库失败！`, errMsg);
                return 'fail';
            });
        return status
    } catch(e) {
        hx.window.showErrorMessage(`项目【${projectName}】初始化Git存储库异常！`, ['我知道了']);
        return 'error';
    }
};


/**
 * @description 获取git信息
 * @param {Object} projectPath
 */
async function gitStatus(workingDir) {
    let result = {
        'gitEnvironment': true,
        'isGit': false,
        'tracking': '',
        'gitStatusResult': [],
        'ahead': '',
        'behind': '',
        'currentBranch': '',
        'BranchTracking': ''
    };
    try {
        let statusSummary = await git(workingDir).status();
        result.isGit = true;
        result.tracking = statusSummary.tracking
        // set branch info
        result.currentBranch = statusSummary.current;
        result.BranchTracking = statusSummary.tracking;
        result.ahead = statusSummary.ahead;
        result.behind = statusSummary.behind;
        result.gitStatusResult = JSON.stringify(statusSummary);
    } catch (e) {
        result.gitEnvironment = false;
        return result;
    };
    return result;
};


/**
 * @description git: add -> commit -> push
 * @param {String} projectPath 项目路径
 * @param {String} commitComment 注释
 */
async function gitAddCommitPush(workingDir, commitComment) {
    let dir = path.join(workingDir, '*');

    // status bar show message
    hx.window.setStatusBarMessage('Git: 正在提交...');
    try {
        let status = await git(workingDir).init()
            .add(dir)
            .commit(commitComment)
            .push()
            .then(() => {
                hx.window.setStatusBarMessage('Git: 提交成功', 3000, 'info');
                return 'success'
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: add -> commit -> push 失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error'
    }
};


/**
 * @description git: add
 * @param {String} projectPath 项目路径
 * @param {Array} files 文件列表
 */
async function gitAdd(workingDir, files) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: 正在添加...');
    if (files == 'all') {
        files = './*'
    };
    try {
        let status = await git(workingDir).init()
            .add(files)
            .then(() => {
                hx.window.setStatusBarMessage('Git: 添加成功', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: ${files} add失败`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description git: commit
 * @param {String} projectPath 项目路径
 * @param {String} commnet 注释
 */
async function gitCommit(workingDir, comment) {
    try {
        let status = await git(workingDir).init()
            .commit(comment)
            .then(() => {
                hx.window.setStatusBarMessage('Git: commit success', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: commit失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description git add -> commit
 * @param {String} projectPath 项目路径
 * @param {String} commnet 注释
 */
async function gitAddCommit(workingDir,commitComment) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: commit...');
    try {
        let status = await git(workingDir).init()
            .add('*')
            .commit(commitComment)
            .then((res) => {
                hx.window.setStatusBarMessage('Git: commit成功', 3000, 'info');
                return 'success'
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: add and commit失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error'
    }
};


/**
 * @description git: push
 * @param {String} projectPath 项目路径
 */
async function gitPush(workingDir) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: 正在向远端推送......`, 2000, 'info');
    try {
        let status = await git(workingDir).init()
            .push()
            .then(() => {
                hx.window.setStatusBarMessage('Git: push success', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: push失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description git: pull
 * @param {String} projectPath 项目路径
 */
async function gitPull(workingDir,options) {
    let args = [];
    let msg = 'Git: git pull 正在从服务器拉取代码...';

    let {rebase} = options;
    if (rebase) {
        args.push(['--rebase'])
        msg = 'Git: git pull --rebase 正在从服务器拉取代码...';
    };

    // status bar show message
    hx.window.setStatusBarMessage(msg, 10000,'info');

    try {
        let status = await git(workingDir).init()
            .pull(args)
            .then(() => {
                hx.window.setStatusBarMessage('Git: pull success', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: pull失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description git: fetch
 * @param {String} projectPath 项目路径
 */
async function gitFetch(workingDir) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: 正在同步信息 ......`);

    try {
        let status = await git(workingDir).init()
            .fetch(['--all','--prune'])
            .then((res) => {
                hx.window.setStatusBarMessage('Git: Fetch success', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel('Git: fetch失败', errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 取消add (取消暂存)
 */
async function gitCancelAdd(workingDir, filename) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: ${filename} 正在取消暂存`);

    try {
        let status = await git(workingDir).init()
            .reset(['HEAD', '--' ,filename])
            .then(() => {
                hx.window.setStatusBarMessage('Git: 取消暂存成功', 3000, 'info');
                return 'success'
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: ${filename}取消暂存失败`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 撤销对文件的修改
 */
async function gitCheckout(workingDir, filename) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: ${filename} 正在撤销对文件的修改`,2000,'info');

    let args = ['--', filename]
    if (filename == 'all') {
        args = ['.']
    };
    try {
        let status = await git(workingDir).init()
            .checkout(args)
            .then(() => {
                hx.window.setStatusBarMessage('Git: 操作成功', 3000, 'info');
                return 'success'
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: ${filename} 操作失败`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 分支操作
 */
async function gitBranch(workingDir) {
    try {
        let status = await git(workingDir).init()
            .branch(['-avv'])
            .then((info) => {
                let branchs = [];
                for (let s in info.branches) {
                    branchs.push(info.branches[s]);
                }
                return branchs;
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: ${workingDir} 查看分支信息失败'`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 分支切换
 */
async function gitBranchSwitch(workingDir,branchName) {
    try {
        let status = await git(workingDir).init()
            .checkout([branchName])
            .then(() => {
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 分支${branchName}切换失败`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 强制删除本地分支
 */
async function gitDeleteLocalBranch(workingDir,branchName) {
    try {
        let status = await git(workingDir).init()
            .branch(['-D',branchName])
            .then(() => {
                hx.window.setStatusBarMessage('Git: 本地分支强制删除成功 !', 3000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 本地分支${branchName}强制删除失败`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 删除远程分支
 */
async function gitDeleteRemoteBranch(workingDir, branchName) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: 正在对 ${branchName} 远程分支进行删除，请耐心等待!`, 5000, 'info');

    try {
        branchName = await branchName.replace('remotes/origin/','');
        let status = await git(workingDir).init()
            .push(['origin', '--delete', branchName])
            .then(() => {
                setTimeout(function() {
                    hx.window.setStatusBarMessage(`Git: 远程分支${branchName}删除成功!`, 30000, 'info');
                },2000);
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 远程分支${branchName}删除失败!`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 分支创建
 */
async function gitBranchCreate(data) {
    let {
        projectPath,
        newBranchName,
        ref,
        isPush
    } = data;

    let args = ['-b',newBranchName];
    if (ref) {
        args = ['-b', newBranchName, ref]
    };

    // status bar show message
    hx.window.setStatusBarMessage(`Git: 正在创建${newBranchName}, 创建成功后会自动刷新当前页面，请勿进行其它操作。`, 5000, 'info');

    if (isPush) {
        try {
            let HEAD = "HEAD:" + newBranchName;
            let status = await git(projectPath).init()
                .checkout(args)
                .push(["origin",HEAD])
                .then(() => {
                    hx.window.setStatusBarMessage(`Git: ${newBranchName} 新分支创建成功`, 30000, 'info');
                    return 'success';
                })
                .catch((err) => {
                    let errMsg = "\n\n" + (err).toString();
                    createOutputChannel(`Git: 分支${newBranchName}创建失败`, errMsg);
                    return 'fail';
                });
            return status;
        } catch (e) {
            return 'error';
        }
    } else {
        try {
            let status = await git(projectPath).init()
                .checkout(args)
                .then(() => {
                    hx.window.setStatusBarMessage(`Git: ${newBranchName} 新分支创建成功`, 30000, 'info');
                    return 'success';
                })
                .catch((err) => {
                    let errMsg = "\n\n" + (err).toString();
                    createOutputChannel(`Git: 分支${newBranchName}创建失败`, errMsg);
                    return 'fail';
                });
            return status;
        } catch (e) {
            return 'error';
        }
    }
};


/**
 * @description push本地新建的分支到远程
 */
async function gitLocalBranchToRemote(workingDir,branchName) {
    // status bar show message
    hx.window.setStatusBarMessage(`Git: 正在把 ${branchName} 推送到远端，请耐心等待!`, 10000, 'info');

    try {
        let status = await git(workingDir).init()
            .push(['--set-upstream', 'origin', branchName])
            .then(() => {
                setTimeout(function() {
                    hx.window.setStatusBarMessage(`Git: ${branchName}推送远端成功!`, 30000, 'info');
                },2000);
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 分支${branchName} push远端失败`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 分支创建并push
 * @param {String} workingDir Git工作目录
 * @param {String} branchName 分支名称
 */
async function gitBranchCreatePush(workingDir,branchName) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: create and push, in progress....!', 10000, 'info');
    try {
        let status = await git(workingDir).init()
            .checkout(['-b',branchName])
            .push(['--set-upstream', 'origin', branchName])
            .then(() => {
                setTimeout(function() {
                    hx.window.setStatusBarMessage(`Git: ${branchName} 创建、并成功推送远端!`, 30000, 'info');
                },2000);
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 分支${branchName} 创建、推送分支失败`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description 分支合并
 */
async function gitBranchMerge(workingDir,fromBranch,toBranch) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: 正在进行合并...', 3000, 'info');

    try {
        let status = await git(workingDir).init()
            .mergeFromTo(fromBranch,toBranch)
            .then((res) => {
                let Msg = "\n\n" + (res).toString();
                createOutputChannel(`Git: 分支合并`, Msg);
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 分支合并失败`, errMsg);
                return 'fail';
            });
        return status
    } catch (e) {
        return 'error';
    }
};


/**
 * @description tags
 * @param {String} workingDir Git工作目录
 */
async function gitTagsList(workingDir) {
    let tagsList = {
        "error": false,
        "data": []
    }
    try {
        let status = await git(workingDir).init()
            .tags()
            .then((res) => {
                tagsList.data = res.all;
                return 'success';
            })
            .catch((err) => {
                tagsList.error = true;
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: tag获取失败`, errMsg);
            });
    } catch (e) {
        tagsList.error = true;
        return tagsList;
    }
    return tagsList;
};

/**
 * @description  git create tag
 * @param {String} workingDir git工作目录
 * @param {String} tagName 标签名称
 */
async function gitTagCreate(workingDir,tagName) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: 正在当前分支上创建标签..., 创建后会自动推送到远端。', 2000, 'info');

    try {
        let status = await git(workingDir).init()
            .tag([tagName])
            .push(['origin',tagName])
            .then(() => {
                hx.window.setStatusBarMessage(`Git: 标签 ${tagName} 创建成功`, 5000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 标签${tagName}创建失败`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};


/**
 * @description clean
 */
async function gitClean(workingDir) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: 开始删除本地未跟踪的文件', 2000, 'info');

    try {
        let status = await git(workingDir).init()
            .clean('f',['-d'])
            .then(() => {
                hx.window.setStatusBarMessage(`Git: 成功删除未跟踪的文件`, 5000, 'info');
                return 'success';
            })
            .catch((err) => {
                let errMsg = "\n\n" + (err).toString();
                createOutputChannel(`Git: 删除未跟踪的文件失败`, errMsg);
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};

/**
 * @description clean
 */
async function gitConfigShow(workingDir) {
    // status bar show message
    hx.window.setStatusBarMessage('Git: git config -l', 2000, 'info');

    try {
        let status = await git(workingDir).init()
            .listConfig()
            .then((res) => {
                res = Object.values(res.values);
                let data = {};
                for (let i of res) {
                    data = Object.assign(data,i);
                };
                let Msg = "\n\n";
                for (let i2 in data) {
                    Msg = Msg + i2 + '=' + data[i2] + '\n';
                }
                createOutputChannel(`Git: 配置文件如下:`,Msg);
                return 'success';
            })
            .catch((err) => {
                hx.window.setStatusBarMessage(`Git: git config读取失败`, 5000, 'error');
                return 'fail';
            });
        return status;
    } catch (e) {
        return 'error';
    }
};

/**
 * @description 获取log
 * @param {Object} workingDir
 */
async function gitLog(workingDir,filterCondition) {
    //--pretty=tformat:"%h | %ad | %s%d | %an" --graph --date=format:"%Y-%m-%d %H:%M:%S"'
    filter = ['-n 100']
    if (filterCondition != 'default') {
        if (filterCondition.includes('-n')) {
            filter = filterCondition.split(',');
        } else {
            let tmp = filterCondition.split(',');
            filter = [...tmp, ...filter]
        };
    };
    try {
        let result = {
            "success": true,
            "errorMsg": '',
            "data": []
        }
        let status = await git(workingDir).init()
            .log(filter)
            .then((res) => {
                let data = res.all;
                result.data = data
                return result;
            })
            .catch((err) => {
                result.errorMsg = err.message;
                result.success = false;
                return result;
            });
        return result;
    } catch (e) {
        result.success = false;
        return result;
    };
};

/**
 * @description 显示远程仓库信息
 */
async function gitRemoteshowOrigin(workingDir){
    hx.window.setStatusBarMessage('Git: 正在运行 git remote show origin',5000,'info');
    let cmd = "cd " + workingDir + "&& git remote show origin"
    await runCmd(cmd)
};

/**
 * @description 文件对比
 */
async function gitDiffFile(workingDir,filename) {
    const cmd = "cd " + workingDir + " && git diff " + filename;
    runCmd(cmd);
};


module.exports = {
    getThemeColor,
    getFilesExplorerProjectInfo,
    gitInit,
    gitStatus,
    gitAdd,
    gitAddCommit,
    gitAddCommitPush,
    gitCancelAdd,
    gitCommit,
    gitPush,
    gitPull,
    gitFetch,
    gitCheckout,
    gitDiffFile,
    gitBranch,
    gitBranchSwitch,
    gitBranchCreate,
    gitDeleteLocalBranch,
    gitDeleteRemoteBranch,
    gitLocalBranchToRemote,
    gitBranchCreatePush,
    gitBranchMerge,
    gitTagsList,
    gitTagCreate,
    gitClean,
    gitConfigShow,
    gitRemoteshowOrigin,
    gitLog
}
