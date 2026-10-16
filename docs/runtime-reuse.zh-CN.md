# 复用 ME 托管环境与受控任务

插件应优先复用宿主已经提供的环境，不必为同一个工具重复打包。组件已随软件分发、已安装就绪、已向插件开放，是三个不同条件；应查询实际状态，不猜测安装目录或版本。

## 能力与状态查询

工作区通过 `MEPlugin.ready()` 检查 `features`：`runtime-catalog` 表示后台查询接口可用；`runtime-execute` 表示宿主已注入共享调度器。旧版本字段缺失时显示兼容提示，不擅自安装替代环境。以下接口均在后台通过 `sdk.request` 调用，需声明 `runtime.tools`；API 2 还须在对应命令的 permissions 中声明。

```js
const { runtimes } = await sdk.request('runtime.catalog', {});
const tool = await sdk.request('runtime.inspect', { id: 'ffmpeg', minVersion: '7.0' });
if (tool.state !== 'ready' || tool.compatible !== true) {
  throw Object.assign(new Error(tool.reason || 'Runtime unavailable'), {
    code: 'PLUGIN_TOOL_UNAVAILABLE'
  });
}
```

catalog 返回 `{schemaVersion:1,runtimes:[...]}`；inspect 返回单个描述对象。字段有 `id`、`kind`、`access`、`state`、`busy`、`version`、`capabilities`、`reason`。查询不返回绝对路径、凭据或账号状态。传入可选 `minVersion` 时增加 `requiredVersion` 和 `compatible`；只支持最多四段数字的最低版本比较，不支持 semver 范围表达式。未知版本为 null，无法证明兼容时返回 `incompatible / VERSION_UNVERIFIED`，不默认判为满足。

状态为 ready、missing、broken、incompatible、busy、unavailable。unavailable / HOST_PROVIDER_UNAVAILABLE 表示宿主没有提供该资源的查询适配，不能据此判断组件未安装。busy 字段可以与 broken/missing 等状态并存。查询不下载、不修复、不更新组件；工具探针有超时与缓存，缓存会随文件标记变化失效，不反复全量校验整个环境。

| 稳定标识 | 类别 | 复用方式与当前边界 |
|---|---|---|
| uv | 工具 | 旧 runtime.tool 可获取托管路径；用于插件私有环境，不能修改 ME 共享环境 |
| 7z | 工具 | 保留旧路径接口；本页受控执行接口尚未开放压缩操作 |
| aria2 | 工具 | 状态可查询；下载业务优先使用宿主服务，尚无通用执行操作 |
| python | 解释器 | 查询取决于宿主适配；额外依赖应进入插件私有 venv，不能 pip 修改宿主 .venv |
| ffmpeg | 工具 | version 与基础 transcode 受控执行；具体编解码能力取决于真实构建 |
| ffprobe | 工具 | version 与 probe 受控执行；不假定与 FFmpeg 来自同一版本 |
| gallery-dl、yt-dlp、f2、baidu-netdisk | 环境 | 状态取决于宿主适配；账号、代理、会话仍经受控业务 API，不提供 Cookie 或内部数据库 |
| voice-asr、voice-tts、voice-wake | 服务 | 状态取决于对应服务适配；不能把查询可用等同于已开放任意模型调用 |
| node | 解释器 | 后台插件已使用宿主运行时，不需要再附带 Node；不开放宿主进程内部对象 |

`access` 为 managed-task、private-env、service-only、path-compat 或 host-runner，仅说明接入方式；实际执行操作仍以本页契约为准。未开放的接口不能通过猜测内部文件或导入主体模块补齐。

## 受控执行

`runtime.execute` 接收结构化对象，不接受 shell、任意可执行路径、自由参数、用户指定优先级或环境变量。它在当前插件任务内等待完成，复用主体注入的调度器；插件不能自行创建第二套调度器。

```js
const version = await sdk.request('runtime.execute', {
  id: 'ffmpeg', operation: 'version', timeoutMs: 10000
});
// version: {taskId, exitCode:0, versionText}

const info = await sdk.request('runtime.execute', {
  id: 'ffprobe', operation: 'probe', assetId: selectedAssetId
});
// info: {taskId, exitCode:0, media:{format,streams}}

const output = await sdk.request('runtime.execute', {
  id: 'ffmpeg', operation: 'transcode', assetId: selectedAssetId,
  directoryToken, name: 'converted.mp3', format: 'mp3'
});
// output: {taskId, exitCode:0, name, size}
```

`assetId` 必须属于本次宿主绑定选区，probe/transcode 另需 `media.read`。transcode 只允许 API 2 命令，命令 effects 包含 write，并在插件和命令 permissions 声明 `ui.dialogs`。directoryToken 来自有效工作区的 `dialog.directory`，经过系统目录选择与明确写入授权；不能传绝对输出路径。

基础转码格式目前是 mp4（H.264/AAC）、mp3、wav、png（首帧）、webp（首帧）。name 必须是单个安全文件名，扩展名匹配 format。容器、编码器或输入不支持时任务失败，不猜测成功。此接口暂不支持自定义滤镜、任意编码参数、覆盖文件或自动把结果导入媒体库；旧 runtime.tool 兼容路径仍保留。

任务在授权目录内创建独立临时子目录，完成后以排他硬链接发布最终文件，最后清理临时文件。不覆盖已有目标；同目标使用宿主冲突键。文件系统不支持硬链接时返回 PLUGIN_OUTPUT_COMMIT_FAILED，不退回不安全覆盖。排队后及完成前复核选区、文件标记、插件状态和目录授权；源文件变化时放弃发布。排队期间目录凭据到期或关闭工作区，也会失败，应保持工作区打开或取消任务。

timeoutMs 默认为 120000，允许 1000 至 1800000 毫秒，计时从子进程启动开始。输出总量最多 256 KiB；超限终止进程并返回 PLUGIN_RUNTIME_OUTPUT_LIMIT。probe 仅返回基础格式/流信息，不返回文件名和任意标签。失败详情可通过 ME 调试日志排查。

## 调度、进度与取消

继续使用外层 `MEPlugin.invoke` 返回的 taskId 查询 status/cancel。execute 返回的 taskId 是受控子任务关联编号，不能拿它查询外层任务状态。运行期间 status.progress.runtime 提供 `{taskId,state,id,coordinatorId}`，state 为 queued/running/finished/cancelled；done/total 为未知量，不生成假百分比。最终成功或失败以外层任务结果为准。

插件任务固定为后台优先级，宿主控制播放与交互优先。资源顺序为计算与冲突许可 → 磁盘 → 执行 → 进程关闭及临时清理 → 释放许可。取消外层任务会传播到所属受控进程树，清理完成前不放行下一项冲突工作。首期同一运行时修订采用独占冲突键，可能排队串行；这不是读共享/写排他的环境升级锁，不能代替运行时管理器的升级保护。

当前接口不保证所有 ME 业务都已接入调度，不会抢占任意已运行进程，不提供 GPU 加权预算，也不承诺操作系统绝对不卡顿。通过旧 runtime.tool 路径自行 spawn 的 trusted-native 插件不受此接口的统一调度约束。共享 Python 附加依赖管理、其它工具受控执行和服务调用需等待对应能力明确开放，不能按本页推断全部已实现。

验证至少覆盖：缺失/损坏/版本未知、离线、中文空格路径、旧接口、真实托管工具执行、已有输出不覆盖、源变化、排队/运行取消、清理后许可归零。开发树成功不能代替实际安装包验证；播放与界面负载需要单独实测。
