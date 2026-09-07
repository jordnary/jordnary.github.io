# 模型来源

- 角色：吸血鬼（Vampire）
- 模型标识：`xixuegui_4`
- [来源页面](https://l2d.su/cn/skins/201233/)
- [原始模型配置](https://static.l2d.su/azurlane/live2d/xixuegui_4/xixuegui_4.model3.json)

用户提供的模型资源用于已确认取得授权的非商业、非盈利个人网站。相关游戏资源的版权及其他权利归原权利人所有；本记录不扩展原有授权范围。

本目录仅保留网站实际使用的模型、贴图、物理配置和九个动作：`idle`、`touch_head`、`touch_special`、`touch_body`、`main_1`、`main_2`、`main_3`、`home`、`mail`。动作组使用原文件名。除待机外，八个回应动作的 `Meta.Loop` 改为 `false`，淡入、淡出分别设为 `0.25s`、`0.35s`；原始关键帧曲线保持不变。`Expressions` 为空，未添加或假定存在独立表情。触摸及自动对话采用用户指定台词，邮箱对白单独编写，`home` 无对白；未接入原游戏语音。
