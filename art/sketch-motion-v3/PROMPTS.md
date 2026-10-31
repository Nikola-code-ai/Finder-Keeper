# Keeper motion v3 source prompts

Built-in image generation, referenced character identity from `art/sketch/concept-preview.png`. All sheets request genuine transparency. Final asset packaging crops, scales, and anchors the drawings; it does not paint or synthesize poses.

## Walk

Use case: illustration-story. Asset type: transparent sprite sheet for a real 2D browser character.
Input image: reference identity only. Match this exact weary clerk: messy black hair, sleepy eyes and large nose, white wrinkled suit, thin black tie, black dress shoes. Loose rough black ink on white paper-shaped body, actual transparent outside silhouette. No gray shading, no colors, no background, no ground line, no props, no captions.
PRIMARY REQUEST: one COMPLETE anatomically correct 12-frame WALK CYCLE, 6 columns and 2 rows, read left-to-right top row then bottom. Character facing RIGHT in every cell, full body at same scale, fixed side/three-quarter camera. Keep generous transparent gaps. Every cell contains ONE figure, no overlap.
CRITICAL: A walk is TWO OPPOSITE STEPS. In the SECOND row the OTHER leg leads. Do NOT simply repeat the first row or keep the same foreground leg forward. To distinguish limbs, keep foreground/near trouser leg clean white, use light black diagonal pen hatching on the background/far trouser leg. Each limb keeps that identity through all twelve frames. Near arm counter-swings opposite near leg. Both legs must visibly alternate.
Frame order:
1 near white leg heel far FORWARD (right), far hatched leg toe far BACK (left), near arm back.
2 near white foot flat forward bearing weight; far heel rises behind.
3 near white leg planted vertical, far hatched knee bends swinging forward behind it.
4 far hatched knee PASSES in FRONT of planted near white leg, far foot lifted.
5 far hatched leg extends forward (right) heel hovering, near white foot trails left.
6 far hatched heel contacts well FORWARD, near white toe BACK, near arm forward.
7 far hatched leg fully FORWARD (right), near white leg fully BACK (left): OPPOSITE silhouette layering to frame1.
8 far hatched foot flat forward bearing weight, near heel rises behind.
9 far hatched leg vertical planted, near white knee bends swinging forward.
10 near white knee PASSES in FRONT of planted far hatched leg, near foot lifted.
11 near white leg extends forward (right) heel hovering; far hatched foot trails left.
12 near white heel contacts FORWARD, far hatched toe BACK, returning smoothly to frame1.
Feet stay on a common baseline inside each cell except the explicitly lifted foot. Body leans tiredly forward, only subtle head bob; deliberate slow shuffling gait, NOT running. Real different drawings, no motion smear. Transparent PNG sprite sheet, high clarity ink lines.

## crawl

Use case: illustration-story. Asset type: transparent animation sprite sheet for a browser character.
Input reference identity: exact weary clerk from reference, messy BLACK hair, sleepy eyes, large nose, white wrinkled suit, thin BLACK tie, BLACK dress shoes. Same proportions. Rough black pen line art, white opaque body interior, transparent outside. No colors, no gray washes, no ground shadow, no captions or cell borders. Use LIGHT BLACK DIAGONAL PEN HATCHING to distinguish far/background limbs from clean white foreground limbs. Separate complete drawings with ample transparent gaps, nothing cropped.
Primary request: 12 DIFFERENT FRAMES of a genuine hands-and-knees CRAWL cycle facing RIGHT. Sheet has 4 columns and 3 rows, read left to right, top to bottom. Fixed side/three-quarter camera with two arms and two legs clearly visible. Torso LOW and ALMOST HORIZONTAL, head held at chest height, tie hanging toward floor. NOT standing, NOT crouch-walking, NOT floating. Knees and open palms are actual planted supports.
An entire cycle alternates diagonal support pairs. The clean-white near arm/leg and lightly hatched far arm/leg remain identifiable. The far limbs must actually change phase.
Frame1: NEAR hand forward right and FAR knee forward under hip; FAR hand back and NEAR knee back. These are contact supports.
Frame2: body weight shifts over planted near hand/far knee; far hand begins lifting, near knee lifts.
Frame3: FAR arm reaches forward through air while NEAR knee swings forward under belly. Near hand/far knee planted.
Frame4: FAR hand reaches farther RIGHT than near hand; NEAR knee moves in FRONT of far knee.
Frame5: FAR palm plants forward; NEAR knee touches down forward.
Frame6: weight settles onto FAR hand + NEAR knee, near hand trails.
Frame7: FAR hand forward and NEAR knee forward, opposite diagonal to frame1, NEAR hand back and FAR knee back.
Frame8: near palm begins lifting and far knee lifts while far hand/near knee support body.
Frame9: NEAR arm reaches forward through air; FAR knee swings forward under belly.
Frame10: NEAR hand reaches farther RIGHT than far hand; FAR knee moves ahead.
Frame11: NEAR palm and FAR knee touch down in front.
Frame12: settle into frame1 supports completing a full alternating crawl.
Keep full body at identical scale, low head height and a consistent palm/knee ground baseline. Draw the support changes, bent elbows, shifting shoulders, and bent knees clearly. Do not repeat one pose twelve times. No props or floor drawn. Actual transparent PNG.


## climb

Use case: illustration-story. Asset type: transparent animation sprite sheet for a browser character.
Input reference identity: exact weary clerk from reference, messy BLACK hair, sleepy eyes, large nose, white wrinkled suit, thin BLACK tie, BLACK dress shoes. Same proportions. Rough black pen line art, white opaque body interior, transparent outside. No colors, no gray washes, no ground shadow, no captions or cell borders. Use LIGHT BLACK DIAGONAL PEN HATCHING to distinguish far/background limbs from clean white foreground limbs. Separate complete drawings with ample transparent gaps, nothing cropped.
Primary request: 12 DIFFERENT FRAMES of a genuine ladder CLIMB cycle, facing RIGHT but body in a slight REAR THREE-QUARTER view so BOTH arms and BOTH legs are clearly distinguishable. Sheet4columns3rows, read left-to-right top-to-bottom. Invisible vertical ladder just to the right of the body; DO NOT DRAW LADDER OR RUNGS because browser draws them.
The second half-cycle MUST have the OTHER ARM HIGH and OTHER KNEE HIGH. Distinguish near white limbs from lightly black-hatched far limbs consistently. Lazy tired effort, weight transfers, bent knees and elbows. Hands gripping invisible rungs, feet resting at different rung heights.
Frame1: NEAR white hand HIGH above head, FAR hatched hand LOW at chest. FAR hatched knee HIGH in front, NEAR white leg long and LOW behind.
Frame2: near high hand pulls, far high knee's foot takes weight, torso rises.
Frame3: FAR hand releases low rung and travels upward past shoulder. NEAR knee starts lifting.
Frame4: FAR hand reaches ABOVE near hand. NEAR knee lifts HIGH, far foot bears weight lower.
Frame5: FAR hand grips high rung; NEAR foot finds high rung.
Frame6: settle: FAR hand HIGH, NEAR hand LOW; NEAR knee HIGH, FAR leg long LOW.
Frame7: clear opposite contact to frame1: FAR hatched arm extended HIGH, NEAR white hand LOW at chest, NEAR knee HIGH, FAR leg long LOW.
Frame8: far high hand pulls, near high foot takes weight, body rises.
Frame9: NEAR hand releases low and travels up. FAR knee begins lifting.
Frame10: NEAR arm reaches ABOVE far hand. FAR knee rises HIGH, near foot bears weight lower.
Frame11: NEAR hand grips high rung; FAR foot finds high rung.
Frame12: settle into NEAR arm HIGH/FAR knee HIGH, returning to frame1.
Keep head and torso proportions fixed, consistent body scale, full shoes visible, no horizontal walking poses, no copy-paste limb configuration. Both hands must exchange high and low rung positions. Transparent PNG.


## pickup

Use case: illustration-story. Asset type: transparent animation sprite sheet. Reference is the character identity: weary sketch clerk, messy black hair, sleepy eyes, big nose, white wrinkled suit, narrow black tie, black dress shoes. Same proportions and rough pen illustration. ONLY black ink and opaque white body, transparent empty background. No gray haze, no glow, no ground shadow, no captions/grid/props. Fixed three-quarter view facing RIGHT. Full body, ample gaps between drawings.
Make 8 genuinely different drawings arranged in4columns2rows, read left-to-right. Top row4frames are a MOUSE PICKUP dangling cycle. An invisible hand holds him by the BACK OF THE JACKET COLLAR, so the shoulders are lifted high near ears, head slightly pulled back, both feet hang limply below, arms droop. No mouse cursor or hand drawn.
1 lifted straight, knees slightly bent and limpfeettoe-down.
2 torso pendulums a little left, left knee flexed right leg hangs longer, arms swinging loosely right.
3 torso pendulums right, right knee flexed left leg hangs longer, arms loosely left. Distinct silhouette opposite to2.
4 shoulders high, he looks annoyed upward, BOTH knees bent with separatefeet.
BOTTOM row4drawings are LANDING impact then recovery:
5 BOTH feet touch ground, knees deeply compress, body stoopedforward, one palm almost touches ground, real low impact crouch.
6 knees decompress halfway, hands brace thighs, hunchback and head tired.
7 nearly standing, legs slightly bent, hands lift off thighs.
8 settled tired standing, both feet planted separately, arms hanging at sides.
All8sameanatomicalbody scale. No ground line. Do not scale crouching character up to same height as standing; preserve body proportions. Transparent PNG.


## away

Use case: illustration-story. Asset type: transparent animation sprite sheet. Reference is the character identity: weary sketch clerk, messy black hair, sleepy eyes, big nose, white wrinkled suit, narrow black tie, black dress shoes. Same proportions and rough pen illustration. ONLY black ink and opaque white body, transparent empty background. No gray haze, no glow, no ground shadow, no captions/grid/props. Fixed three-quarter view facing RIGHT. Full body, ample gaps between drawings.
Make a complete12frame rear-view walk cycle,6columns2rows. Character turned AWAY from camera, body facing toward upperRIGHT but feet moving RIGHT in side/back three-quarter view. We see back of head, jacket back, only little nose right edge.
Critical two opposite steps, not repeatedsameleadleg. Keep NEAR LEFT trouser leg white, FAR RIGHT trouser leg lightly black crosshatched consistently. Everylimbretainsidentity.
1 nearwhite heel forwardRIGHT, farhatched toe backLEFT; neararm back.
2 nearwhite foot bearsweight, farheel lifts.
3 nearwhite legvertical, farhatched knee swingsforward.
4 farhatched knee passes nearwhite knee.
5 farhatched foot extendsforwardRIGHT.
6 farhatched heelplants forward, nearwhitetoe back.
7 farhatched legclearly leadsFORWARD, nearwhiteback: opposite limbconfiguration from1.
8 farhatched footbearsweight, nearwhiteheel lifts.
9 farhatchedlegvertical, nearwhiteknee swingsforward.
10 nearwhitekneepassesfarhatchedknee.
11 nearwhitefootextendsforwardRIGHT.
12 nearwhiteheelplantsforward, farhatchedtoeback, returns1.
Slow tired shuffling, opposedarm swing, subtlebodybob. Transparent PNG,12separateddrawings.

## crawlRevision — selected revision

Use case: illustration-story. Asset type: transparent 8-frame crawl sprite sheet.
Input image1 is exact character identity. Inputimage2 is REJECTED crawl attempt to correct. Preserve weary clerk: messyblackhair, tiredface, whitewrinkledsuit, thinblacktie, blackshoes. Loose BLACK pen on OPAQUE WHITE body with real transparent background, NOglow, NOhalo, NOgraybackground. Slight diagonal high angle facingRIGHT, seeBOTHshoulders and BOTH arms.
PRIMARY CORRECTION: rejected image2 almostalwayshasforegroundhandforward and backgroundhandback. Newcycle MUST HAVE background hatched hand farther RIGHT than foreground cleanwhitehand for ENTIRE SECOND HALF. This is a real hands-and-knees crawl, torsonearlyhorizontal, palms/knees lowtofloor, not a crouchwalk. Use clearly DISTINCT limbpositions.
Layout4columns2rows8complete separateddrawings, consistentbodyscale:
TOPROW NEAR FOREGROUND WHITE ARM DOMINATES FORWARD:
0 whitepalmfarRIGHT, hatchedpalmfarLEFT underchest; whitekneeBACKleft, hatchedkneeFORWARDright.
1 keepwhitehandplantedRIGHT while hatchedarmliftsandreachesahead; nearwhitekneeliftsforward,farhatchedkneeplanted.
2 hatchedhandfarRIGHT INAIR beyondplantedwhitehand; whitekneeforwardintheair,hatchedkneeback.
3 hatchedhandplants atfarRIGHT; whitehandstartsretreatingleft; whitekneeplantsFORWARDright,hatchedkneebackleft.
BOTTOMROW FAR BACKGROUND HATCHED ARM DOMINATES FORWARD:
4 HATCHEDpalmfarRIGHT fullyextendedforward infrontofhead; WHITEpalmfarLEFT underchest bentnearverticalforearm; WHITEkneeforwardright,HATCHEDkneebackleft. This must clearly be the oppositebodyconfiguration to0.
5 HATCHEDpalmstaysplantedfarRIGHT, WHITEarmliftsunderchest andstartsswingingright; HATCHEDkneeliftsforward.
6 WHITEhandextendsfarRIGHTpasttheHATCHEDhand, palmnotyettouching; HATCHEDkneeforwardintheair,WHITEkneeback.
7 WHITEhandplantsfarRIGHT, HATCHEDhandrestsfarLEFTunderchest, HATCHEDkneeforwardright,WHITEkneebackleft; closecycleto0.
Hatched far limbs stay hatched throughout. White near limbsstaywhite. Neverhideanentirelimb. No floor or props. TransparentPNG.


## awayRevision — selected revision

Use case: illustration-story. Assettype:8-frame transparentrearwalking sprite sheet.
Input1identityexacttiredclerk; input2correctsidewalkcycle demonstratesalternatelegs. Redraw his body FROMBEHIND facingdiagonallyAWAYandRIGHT, but use input2's alternating white/hatchedlegs phase. Notfrontface. Messyblackhair, whitewrinkledjacketback, whiteforegroundnearleg, hatchedbackgroundfarleg,blackshoes,roughblackinkandopaquewhiteonly, genuinelytransparentnobackground/nohalo.
8completeframes4columns2rows. Fullbodyidenticalscale, commonfeetbaseline. Do NOT repeatthesameleadleg.
0 WHITEnearlegFORWARDright and HATCHEDfarlegBACKleft; whiteheel contactsright. Armscounterposed.
1 WHITEstraightlegplanted, HATCHEDfootliftsfrombehindleftandbendsatknee.
2 HATCHEDkneepassesinfrontofWHITEleg, HATCHEDfootliftedright, WHITEfootplantedleft.
3 HATCHEDlegextendsFORWARDright,WHITElegtrailsBACKleft, HATCHEDheelcontactsright.
4 HATCHEDfarlegFORWARDright and WHITEnearlegBACKleft, oppositeleadtoframe0.
5 HATCHEDstraightlegplanted, WHITEfootliftsfrombehindleftbendingknee.
6 WHITEkneepassesinfrontofHATCHEDleg,WHITEfootliftedright,HATCHEDfootplantedleft.
7 WHITElegextendsFORWARDright,HATCHEDlegtrailsBACKleft,WHITEheelcontactsright, loopto0.
Keep exact WHITE vsHATCHED legidentityeachframe. Do notjustchangehatchingonidenticallegs: knee bends,shoeorientation,oppositearmswingallchange. Real anatomicallycorrectslowslouchywalk. TransparentPNG.
