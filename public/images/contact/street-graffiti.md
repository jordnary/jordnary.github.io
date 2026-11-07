# Contact 背景素材

更新日期：2026-11-07。使用内置 `image_gen` 完成原图细化及独立衔接图绘制。

## 文件

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `street-graffiti.webp` | 1536 × 1024 | 保留的原始参考图，创建于 2026-10-22 |
| `street-graffiti-hd.webp` | 3072 × 2048 | 高清主图，延续原图构图 |
| `street-graffiti-continuation.webp` | 3072 × 1792 | 单独绘制、完成边缘衔接的连接图 |
| `street-graffiti-cycle.webp` | 3072 × 3840 | 页面使用的“高清主图 + 衔接图”完整循环单元，约 1739 KiB |
| `street-graffiti-cycle-1536.webp` | 1536 × 1920 | 中等尺寸，约 407 KiB |
| `street-graffiti-cycle-768.webp` | 768 × 960 | 小尺寸，约 93 KiB |

## 清晰度与连接方式

- 首轮完整画面的实际生成尺寸为 1536 × 1024。随后将两张画面的左右边缘各分成上下两个重叠区域，以 512 × 768 的参考区域生成 1024 × 1536 的细节图，再合成 3072 像素宽的主素材。两侧笔触经过重新细化，中央留白使用重采样；这些不是原生 4K 宽度图像。
- 合成时只在分区重叠处以及图片连接处混合边缘，保留纸面、干刷和墨点的清晰度。没有整图模糊、全局白色遮罩或镜像翻转。
- 衔接图的头部承接主图底部。尾部使用衔接图的实际笔触与主图顶部作为上下参照，单独补绘二者之间的画面。页面严格按照 **主图 → 衔接图 → 主图 → 衔接图** 的顺序循环，两张图始终正向显示。
- 页面使用预先拼好的循环单元，避免独立图片在缩放时产生累计定位误差。循环高度按 `100vw × 5 / 4` 四舍五入至完整 CSS 像素。
- `srcset` 按视口和像素密度选择 768、1200、1536 或 3072 像素版本。1200 档在构建时从完整循环单元生成，覆盖 390 px、DPR 3 的屏幕。CSS 背景复用实际加载图片的 `currentSrc`，与路由预加载共享同一资源。
- WebP 主素材使用质量 94，小尺寸版本使用质量 92；导出时不携带源文件元数据。PNG 中间素材不参与网站部署。
- 背景不接收指针事件，装饰图片对辅助技术隐藏，并在强制颜色模式下隐藏。

## 生成提示词

完整画面细化：

> Use case: precise-object-edit. Asset type: high-resolution full-width Contact webpage background. Input image 1 is the EDIT TARGET. Restore and enhance its resolution as faithfully as possible. Deliver a 3456 x 2304 pixel landscape 3:2 image (or the highest supported 3:2 resolution). Keep the entire composition, exact placement and shape of the existing stars, paper airplanes, all edge brush marks, ink splashes, white central negative space, and muted blue / dark petrol / peach palette. Preserve the original white paper color across every boundary. Reconstruct finely resolved dry-brush bristles, sharp natural ink edges, small individual paint droplets, and subtle paper fibers at native high resolution. The goal is the SAME artwork with clean detailed brushwork on a maximized desktop display. Keep the original hand-painted character, natural imperfections and gentle colors. Do not crop or zoom. No new objects, no text, no logo, no watermark, no blur, no foggy wash, no excessive sharpen halos, no smooth vectorization. Keep central paper quiet and clean; do not exaggerate grain.

衔接图的绘制提示词如下；初始提示按独立延展纹理设计，最终按“主图—衔接图”循环要求重新处理回接边缘：

> Use case: compositing. Asset type: separate lower continuation background tile for a long Contact webpage. Input image 1 is the supporting style and boundary reference, NOT the final composition to repeat. Create a NEW 3:2 landscape mural panel that continues immediately DOWNWARD from the BOTTOM edge of the reference, at the same scale and palette. The top and bottom of this new panel must both visually meet the reference bottom edge so this new panel is vertically seamless with itself, without flipping or mirroring. At top left continue the existing dark petrol / muted blue dry brush and tiny peach flecks entering from the reference's bottom left; at top right continue the existing dense blue splatter and curved brush moving out of the reference's bottom right. Develop those edge marks into DIFFERENT natural sweeping ink strokes, sparse fine droplets and subtle thin doodle curves along the two outer edges, with a calm open white paper center occupying the central 70%. Keep edge artwork roughly within the outer 12-15% each side. Keep the SAME off-white paper tone, subtly fibrous plaster-paper texture, muted slate / denim blue, petrol and peach ink, visibly tactile dry brush bristles with crisp grain and fine droplets. Make the middle of this extension quieter, with airy asymmetrical brushwork that flows vertically and varies naturally. No duplicate large stars or paper airplanes, no recognizable text or symbols. Do not reflect, rotate, or repeat the reference artwork. No top border or bottom border. No blur, cloudy washes, fog, watermark, text, UI, shadows. Produce the highest supported detailed landscape resolution, preferably 3456 x 2304. This is ONLY the separate continuation panel, not a stacked comparison or collage.

最后一轮分区细化提示词（对衔接图四个区域分别使用）：

> Use case: precise-object-edit. Restore this EXACT cropped mural fragment from 512 x 768 into a native 1024 x 1536 portrait image. The input is an EDIT TARGET, NOT general inspiration. All shapes and edge positions must remain precisely aligned at 2x scale. Preserve the muted blue and peach palette and original white paper brightness; no increased saturation or contrast. Increase resolution and finely resolved brush bristles, delicate ink droplets and paper fiber detail only. Keep original thin dry brush edges, no thickening or graphic simplification. Preserve every curve and ink mark in exactly the same proportional placement. Keep the blank paper region quiet. No new symbols, no cropping or reframing, no borders, no new grain, no blur, no text. The output will be stitched with adjacent original art, so geometric fidelity and unchanged color are essential.

接回下一张主图的补绘提示词：

> Use case: compositing, precise inpainting. Input image is a 1536 x 1024 landscape image with one missing horizontal band, filled with plain gray, from y=512 through y=767. RESTORE ONLY THIS GRAY BAND, keep all artwork above and below pixel-registered, same canvas and framing. Replace gray with continuous white textured paper and finely painted blue/peach dry brush flourishes restricted to the far left and right edges. Connect the existing paint marks at the TOP and BOTTOM edges of the missing band into flowing, naturally tapering ink strokes, as if this were one continuous hand-painted page. The intervening central 70% must be quiet, subtly textured white paper matching the existing paper in color and brightness. Keep edge marks crisp and the thin brushwork delicate; let splatter and the bristle marks at the band edges continue naturally. Do not fill with thick blocks of pigment. No horizontal seam, no rectangular color change, no straight border line, no stretching of pixel rows, no soft blurs. Do not add more stars, paper airplanes or symbols; preserve both existing bottom stars and the paper airplane exactly where they already are, entirely BELOW the repaired band. No text. Output the WHOLE restored 3:2 image, not a crop. This will be registered back to the surrounding original art, so do not move or rescale the preserved areas.
