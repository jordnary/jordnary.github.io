"""Prepare the supplied tower drawings as aligned grayscale learning artwork.

The two reference captures share their x coordinates. Pixel comparison of the
completed vertical ribs puts the base capture at y=601 in the upper capture.
All exported layers use one uniform scale and translation; no geometry is
stretched. Pillow and NumPy are required.
"""

from pathlib import Path
import io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'scripts'/'assets'
OUTPUT=ROOT/'public'/'images'/'learning'
CACHE=ROOT/'node_modules'/'.cache'/'learning-architecture'
SOURCE_WIDTH=1277
SOURCE_HEIGHT=1257
BASE_Y=601
SCALE=1000/SOURCE_WIDTH
PAD_Y=(1200-SOURCE_HEIGHT*SCALE)/2
EXPORT_SCALE=2


ROOFLINE=[
    (253,191),(257,187),(272,199),(272,172),(276,168),(288,178),
    (288,154),(292,151),(306,162),(306,135),(310,131),(324,143),
    (324,114),(328,111),(343,124),(343,94),(347,90),(362,103),
    (362,70),(366,67),(424,118),(424,157),(443,174),(443,138),
    (481,98),(486,101),(486,159),(496,140),(504,124),(508,122),
    (513,126),(513,165),(524,151),(529,144),(533,147),(533,186),
    (544,172),(551,166),(555,169),(555,208),(566,194),(574,186),
    (578,190),(578,223),(589,210),(595,204),(599,208),(599,242),
    (608,229),(615,223),(619,227),(619,261),(627,248),(634,240),
    (638,244),(638,278),(647,265),(653,259),(657,263),(657,297),
    (666,283),(673,275),(677,279),(677,312),(686,299),(690,290),
    (693,294),(693,347),(703,357),
]


def mask_polygons(polygons,size=(SOURCE_WIDTH,SOURCE_HEIGHT),offset_y=0):
    mask=Image.new('L',size,0)
    pen=ImageDraw.Draw(mask)
    for polygon in polygons:
        pen.polygon([(x,y+offset_y) for x,y in polygon],fill=255)
    return np.asarray(mask).astype(np.float32)/255


def repair_vertical(gray,mask,distance=6):
    """Restore tiny annotations from the same ribs immediately above/below."""
    result=gray.copy()
    ys,xs=np.where(mask)
    for y,x in zip(ys,xs):
        samples=[]
        for dy in (-distance-3,-distance,distance,distance+3):
            yy=min(max(y+dy,0),gray.shape[0]-1)
            if not mask[yy,x]:
                samples.append(gray[yy,x])
        if samples:
            result[y,x]=np.median(samples)
    return result


def repair_return_wall(gray):
    """Complete the two shaded planes behind the capture's baked reveal edge.

    Sample graphite from the same concrete plane, rather than extending the
    pale front facade over the darker side wall. Only the bright reveal holes
    and their antialiased rims are replaced; the original grain stays intact.
    """
    height,width=gray.shape
    yy,xx=np.indices(gray.shape)
    planes=mask_polygons([
        [(0,249),(91,225),(91,456),(0,449)],
        [(0,449),(87,456),(87,524),(0,618)],
    ],size=(width,height))
    holes=(gray>193)&(xx<29)&(planes>.5)
    patch=Image.fromarray((holes*255).astype(np.uint8),'L')
    patch=patch.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(.6))
    weight=np.asarray(patch).astype(np.float32)/255*planes
    # Follow the shallow concrete joint above, then the diagonal shadow below,
    # keeping samples inside the same plane as they move to the right.
    donor_x=np.minimum(xx+35,width-1)
    donor_y=np.where(yy>=570,yy-38,np.minimum(yy+3,height-1))
    donor=gray[donor_y,donor_x]
    repaired=gray*(1-weight)+donor*weight
    # The pale plinth also contains a baked white wave. Continue the same
    # concrete beneath the diagonal shadow, blending into untouched grain.
    plinth=mask_polygons([
        [(0,619),(30,587),(30,652),(0,650)],
    ],size=(width,height))
    light_weight=plinth*np.clip((30-xx)/12,0,1)
    return repaired*(1-light_weight)+gray[yy,donor_x]*light_weight


def compose_gray():
    upper=np.asarray(Image.open(ASSETS/'learning-tower-upper-reference.png').convert('RGB')).astype(np.float32)
    base=np.asarray(Image.open(ASSETS/'learning-tower-base-reference.png').convert('RGB')).astype(np.float32)
    # The orange disc is multiplied into the source. Its red channel retains
    # the monochrome building values without the red/green contamination.
    top=upper[:,:,0]
    yy,xx=np.indices(top.shape)
    marker=(xx>=345)&(xx<=360)&(yy>=338)&(yy<=354)
    top=repair_vertical(top,marker,18)
    # The annotation is a shallow quadratic, measured from the saturated
    # pixels outside the sun disc (mean fit error below a quarter pixel).
    guide_y=-.000188269529*xx*xx+.649359318*xx+139.598320
    orange=(upper[:,:,0]-upper[:,:,1]>16)&(upper[:,:,0]-upper[:,:,2]>25)
    guide=(xx>=358)&(xx<=925)&(np.abs(yy-guide_y)<3.5)&orange
    top=repair_vertical(top,guide,7)
    # Remove the one oblique drafting pointer that crosses the right-hand ribs.
    slash_y=350-(xx-499)*180/249
    slash=(xx>=499)&(xx<=704)&(np.abs(yy-slash_y)<1.6)
    top=repair_vertical(top,slash,5)

    bottom=repair_return_wall(base[:,:,0])

    gray=top[:SOURCE_HEIGHT,:SOURCE_WIDTH].copy()
    height=min(bottom.shape[0],SOURCE_HEIGHT-BASE_Y)
    for row in range(height):
        blend=min(1,row/13)
        gray[BASE_Y+row,:bottom.shape[1]]=(gray[BASE_Y+row,:bottom.shape[1]]*(1-blend)+bottom[row]*blend)
    return gray


def building_mask():
    tower=ROOFLINE+[(703,1161),(672,1161),(672,960),(253,862)]
    upper=mask_polygons([tower])
    base_shapes=[
        [(0,246),(96,221),(672,358),(672,482),(96,437),(0,452)],
        [(0,452),(96,437),(672,482),(672,559),(424,570),(424,541),(95,541),(0,592)],
        [(0,541),(424,541),(424,635),(88,655),(0,650)],
        [(424,570),(703,568),(947,577),(1025,574),(1025,581),(655,616),(424,603)],
    ]
    mask=np.maximum(upper,mask_polygons(base_shapes,offset_y=BASE_Y))
    return mask


def return_wall_edge():
    """Keep the reference's narrow paper-edge bites as real transparency.

    The repaired concrete beneath this alpha remains complete. Sampling only
    paper connected to the image border excludes bright concrete specks and
    leaves the main return-wall corner entirely intact.
    """
    source=np.asarray(Image.open(ASSETS/'learning-tower-base-reference.png').convert('RGB'))[:,:,0]
    edge_width=25
    paper=source[:,:edge_width]>211
    paper[:260]=False
    paper[562:]=False
    connected=np.zeros_like(paper)
    pending=[(int(y),0) for y in np.flatnonzero(paper[:,0])]
    while pending:
        y,x=pending.pop()
        if connected[y,x] or not paper[y,x]:
            continue
        connected[y,x]=True
        for ny,nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0<=ny<paper.shape[0] and 0<=nx<edge_width:
                pending.append((ny,nx))
    erosion=Image.new('L',(SOURCE_WIDTH,SOURCE_HEIGHT))
    erosion.paste(Image.fromarray((connected*255).astype(np.uint8),'L'),(0,BASE_Y))
    # In pale concrete the paper has almost the same luminance. Finish these
    # outer bites geometrically, with the same soft, uneven rounded outline.
    pen=ImageDraw.Draw(erosion)
    for x0,y0,x1,y1 in (
        (-13,586,17,614),(-8,608,8,625),(-7,631,5,640),
    ):
        pen.ellipse((x0,y0+BASE_Y,x1,y1+BASE_Y),fill=255)
    erosion=erosion.filter(ImageFilter.GaussianBlur(.65))
    return 1-np.asarray(erosion).astype(np.float32)/255


def landscape_masks():
    # The trees and their existing beds remain one layer, so their root-to-soil
    # relation survives the fade-in without reconstructing or repositioning it.
    canopy=[
        # A generous clean-paper window avoids cutting individual twigs or
        # crown tips. The notch excludes the stray upper drafting line.
        [(703,269),(752,269),(752,247),(1252,247),(1252,568),(703,568)],
    ]
    beds=[
        [(702,541),(1249,542),(1249,558),(703,559)],
        [(709,549),(792,550),(792,558),(710,558)],
        [(753,562),(892,562),(947,558),(947,570),(892,576),(753,574)],
        [(944,550),(1037,550),(1037,563),(944,563)],
        [(1097,542),(1245,543),(1249,573),(1100,570)],
    ]
    return mask_polygons(canopy+ beds,offset_y=BASE_Y),mask_polygons(beds,offset_y=BASE_Y)


def rgba_layers(gray):
    # White architectural surfaces stay opaque. The bright paper outside the
    # building becomes transparent, with fine graphite retained in the mask.
    tone=np.clip((gray-6)*255/240,0,255)
    structure=building_mask()*return_wall_edge()
    art=np.empty((SOURCE_HEIGHT,SOURCE_WIDTH,4),dtype=np.uint8)
    art[:,:,:3]=tone[:,:,None].astype(np.uint8)
    art[:,:,3]=(structure*255).astype(np.uint8)
    trees_region,beds=landscape_masks()
    ink=np.clip((236-gray)/218,0,1)
    ink[ink<.048]=0
    trees=np.zeros_like(art)
    trees[:,:,3]=(ink*trees_region*255).astype(np.uint8)
    # Retain the actual light stone caps and dark soil of the planting beds.
    solid=beds>.5
    trees[solid,:3]=tone[solid,None].astype(np.uint8)
    trees[solid,3]=255
    return Image.fromarray(art,'RGBA'),Image.fromarray(trees,'RGBA')


def place(layer):
    size=(round(SOURCE_WIDTH*SCALE*EXPORT_SCALE),round(SOURCE_HEIGHT*SCALE*EXPORT_SCALE))
    resized=layer.resize(size,Image.Resampling.LANCZOS)
    # Mild luminance sharpening restores sampling softness without inventing
    # stone grain or altering the carefully aligned alpha contours.
    rgb=resized.convert('RGB').filter(ImageFilter.UnsharpMask(radius=.65,percent=42,threshold=3))
    rgb.putalpha(resized.getchannel('A'))
    canvas=Image.new('RGBA',(1000*EXPORT_SCALE,1200*EXPORT_SCALE))
    canvas.alpha_composite(rgb,(0,round(PAD_Y*EXPORT_SCALE)))
    return canvas


def save_webp(image,path):
    for quality in (94,92,90,88,86):
        output=io.BytesIO()
        image.save(output,format='WEBP',quality=quality,method=6,exact=True)
        payload=output.getvalue()
        if len(payload)<500_000 or quality==86:
            path.write_bytes(payload)
            print(f'{path.name}: {len(payload)//1024} KB, quality {quality}')
            return


def outline_svg():
    # Authored structural paths, not photographic edge detection. The taller
    # ribs are shared with the source silhouette and the ground portal follows
    # the completed base image. Environmental marks never enter this layer.
    paths=[]
    def line(points,close=False,width=1.25):
        d='M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+('Z' if close else '')
        paths.append(f'<path d="{d}" stroke-width="{width}"/>')
    def floor(x):
        return BASE_Y+222+(x-96)*.238
    left=[(253,191),(272,172),(288,154),(306,135),(324,114),(343,94)]
    for x,y in left:
        end=floor(x)
        line([(x,y),(x+4,y-3),(x+4,end+1),(x,end)],True)
        line([(x+4,y+2),(x+17,y+12),(x+17,floor(x+17))],False,1)
        for floor_y in (330,456,580,706,800):
            py=floor_y+(x-253)*.34
            if py<end-5:
                line([(x,py),(x+4,py+2),(x+17,py+7)],False,.85)
    line([(362,70),(366,67),(424,118),(424,floor(424)),(362,floor(362))],True)
    line([(366,67),(366,floor(366))],False,1)
    for y in (177,280,384,488,592,696,800):
        line([(366,y),(424,y+38)],False,.9)
    line([(443,138),(481,98),(486,101),(486,floor(486)),(443,floor(443))],True)
    line([(481,98),(481,floor(481))],False,1)
    for y in (279,426,573,720,867):
        if y<floor(443):
            line([(443,y),(481,y-39),(486,y-36)],False,.9)
    right=[(496,140,504,124),(514,161,529,144),(538,183,551,166),
           (561,205,574,186),(584,225,595,204),(605,245,615,223),
           (624,263,634,240),(643,282,653,259),(663,300,673,275),
           (682,319,690,290)]
    for x,y,edge,tip in right:
        end=floor(edge) if edge<670 else BASE_Y+558
        line([(x,y),(edge,tip),(edge+4,tip+3),(edge+4,end+1),(x,end-2)],True,1.15)
        line([(edge,tip),(edge,end)],False,.95)
        for py in (470,617,764,911,1060):
            if py<end-5:
                line([(x,py),(edge,py-9),(edge+4,py-7)],False,.75)
    line([(693,347),(703,357),(703,BASE_Y+559),(694,BASE_Y+560)],False,1.15)

    def base(points,close=False,width=1.25):
        line([(x,y+BASE_Y) for x,y in points],close,width)
    base([(0,246),(96,221),(672,358),(672,482),(96,437)])
    base([(0,447),(90,454),(96,437)],False,1.1)
    base([(96,221),(96,437)])
    base([(95,441),(672,486)],False,.8)
    base([(90,454),(90,521),(0,618)],False,1)
    base([(95,441),(145,446),(145,541),(95,541)],True)
    base([(334,460),(392,465),(392,541),(334,541)],True)
    base([(495,478),(552,483),(552,583),(495,583)],True)
    base([(424,493),(493,493),(493,566),(424,566)],True)
    for x in (564,581,598,614,631,648,670,687,703):
        base([(x,484),(x,560)],False,.95)
    base([(0,541),(424,541),(424,635),(88,655),(0,650)])
    base([(88,542),(88,653)],False,.85)
    base([(424,572),(703,568),(928,561)],False,1)
    base([(424,585),(655,599),(1001,570)],False,1)
    base([(424,602),(655,616),(1025,581)],False,1.15)
    base([(655,599),(655,616)],False,.9)
    base([(90,541),(90,655)],False,1.15)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200" width="1000" height="1200"><title>Tower structural drawing</title><defs><clipPath id="tower-frame"><rect x="0" y="0" width="1277" height="1257"/></clipPath></defs><g transform="translate(0 {PAD_Y:.5f}) scale({SCALE:.8f})" clip-path="url(#tower-frame)" fill="none" stroke="#252525" stroke-linecap="round" stroke-linejoin="round">'+''.join(paths)+'</g></svg>\n'


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    CACHE.mkdir(parents=True,exist_ok=True)
    gray=compose_gray()
    tower,trees=rgba_layers(gray)
    tower=place(tower)
    trees=place(trees)
    save_webp(tower,OUTPUT/'hero-tower-sketch.webp')
    save_webp(trees,OUTPUT/'hero-tower-trees.webp')
    (OUTPUT/'hero-tower-outline.svg').write_text(outline_svg(),encoding='utf-8')
    preview=Image.new('RGBA',tower.size,'#f3f2ec')
    preview.alpha_composite(tower)
    preview.alpha_composite(trees)
    preview.convert('RGB').resize((1000,1200),Image.Resampling.LANCZOS).save(CACHE/'tower-reference-preview.png')
    sun_preview=Image.new('RGBA',tower.size,'#f3f2ec')
    pen=ImageDraw.Draw(sun_preview)
    cx=762*SCALE*EXPORT_SCALE
    cy=(285*SCALE+PAD_Y)*EXPORT_SCALE
    radius=219*SCALE*EXPORT_SCALE
    pen.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill='#ef4e28')
    sun_preview.alpha_composite(tower)
    sun_preview.alpha_composite(trees)
    sun_preview.convert('RGB').resize((1000,1200),Image.Resampling.LANCZOS).save(CACHE/'tower-reference-sun-preview.png')
    print(f'Sun logical center: {762*SCALE:.2f}, {285*SCALE+PAD_Y:.2f}; radius {219*SCALE:.2f}')
    print(f'Source scale {SCALE:.8f}, vertical offset {PAD_Y:.5f}; base source offset {BASE_Y}')


if __name__=='__main__':
    main()
