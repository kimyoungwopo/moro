// SPDX-License-Identifier: MIT
// Original Moro geometry and choreography. No imported assets or tracing.
import { writeFile } from 'node:fs/promises';
const C = { teal: '#1B6C80', gold: '#D79A4E', mist: '#DDE9EC', ink: '#203B42', paper: '#FFFFFF' };
const prop = k => ({ a: 0, k });
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
const fill = (color, opacity = 100) => ({ ty: 'fl', c: prop(rgb(color)), o: prop(opacity), r: 1 });
const stroke = (color, width = 2, opacity = 100) => ({ ty: 'st', c: prop(rgb(color)), o: prop(opacity), w: prop(width), lc: 2, lj: 2, ml: 4 });
const rect = (x, y, w, h, r = 0) => ({ ty: 'rc', d: 1, p: prop([x, y]), s: prop([w, h]), r: prop(r) });
const ellipse = (x, y, w, h = w) => ({ ty: 'el', d: 1, p: prop([x, y]), s: prop([w, h]) });
const path = (v, closed = false, incoming, outgoing) => ({ ty: 'sh', ks: prop({ v, i: incoming ?? v.map(() => [0, 0]), o: outgoing ?? v.map(() => [0, 0]), c: closed }) });
const group = (name, geometry, ...paint) => ({ ty: 'gr', nm: name, it: [...(Array.isArray(geometry) ? geometry : [geometry]), ...paint] });
const tile = (name, x, y, w, h, r, color) => group(name, rect(x, y, w, h, r), fill(color));
const dot = (name, x, y, diameter, color) => group(name, ellipse(x, y, diameter), fill(color));
const line = (name, points, color, width = 2, opacity = 100) => group(name, path(points), stroke(color, width, opacity));
// Deliberate endpoint keyframes make the 240 -> 0 seam identical.
const motion = pairs => ({ a: 1, k: pairs.map(([t, v], i) => ({ t, s: Array.isArray(v) ? v : [v], ...(i < pairs.length - 1 ? { e: Array.isArray(pairs[i + 1][1]) ? pairs[i + 1][1] : [pairs[i + 1][1]], o: { x: [.32], y: [0] }, i: { x: [.2], y: [1] } } : {}) })) });
const transform = (p = [320, 320], extra = {}) => ({ o: prop(100), r: prop(0), p: prop([...p, 0]), a: prop([0, 0, 0]), s: prop([100, 100, 100]), ...extra });
const positions = pairs => motion(pairs.map(([t, p]) => [t, [...p, 0]]));
const scales = pairs => motion(pairs.map(([t, s]) => [t, [s, s, 100]]));
// Lottie paints earlier shape groups above later ones. Author back-to-front, serialize front-to-back.
const layer = (nm, shapes, ks = transform()) => ({ ddd: 0, ty: 4, nm, sr: 1, ks, ao: 0, shapes: shapes.toReversed(), ip: 0, op: 240, st: 0, bm: 0 });
const trim = pairs => ({ ty: 'tm', s: prop(0), e: motion(pairs), o: prop(0), m: 1 });
const base = (nm, layers, markers) => ({ v: '5.13.0', fr: 60, ip: 0, op: 240, w: 640, h: 640, nm, ddd: 0, assets: [], layers: layers.toReversed().map((l, i) => ({ ...l, ind: i + 1 })), markers: markers.map(([tm, cm]) => ({ tm, cm, dr: 0 })) });
const sheet = () => [
  layer('Paper lift / offset cut edge', [tile('Cut-edge shadow', 0, 0, 488, 500, 30, C.mist)], transform([324, 330])),
  layer('Editorial sheet', [group('Paper field', rect(0, 0, 488, 500, 30), fill(C.paper), stroke(C.mist, 1.5))], transform([320, 320])),
  layer('Edition furniture / geometric not typography', [tile('Section bar', -153, -191, 30, 5, 2.5, C.teal), tile('Headline rule', -94, -191, 68, 5, 2.5, C.ink), tile('Secondary rule', -126, -175, 83, 3, 1.5, C.mist), dot('Folio one', 150, -191, 5, C.gold), dot('Folio two', 163, -191, 5, C.mist), dot('Folio three', 176, -191, 5, C.mist), line('Footer rule', [[-170, 193], [170, 193]], C.mist, 1.5), tile('Footer imprint', -146, 209, 48, 4, 2, C.ink), tile('Footer serial', 140, 209, 60, 4, 2, C.mist)]),
];
const barcode = (x, y, heights = 18) => [2, 4, 2, 2, 5, 2, 3, 2, 4, 2, 2, 3].map((w, i) => tile(`Authored barcode bar ${i + 1}`, x + i * 6, y, w, heights - (i % 3 === 0 ? 3 : 0), .5, C.ink));

const dispatch = base('Dispatch / a parcel in good hands', [
  ...sheet(),
  layer('Route foundation', [group('Rounded shipping itinerary', path([[-182, 74], [-156, 100], [154, 100], [180, 74], [180, -106], [154, -132]], false, [[0, 0], [-14, 0], [0, 0], [0, 14], [0, 0], [14, 0]], [[0, 14], [0, 0], [14, 0], [0, 0], [0, -14], [0, 0]]), stroke(C.mist, 3))]),
  layer('Route draw / dispatched to destination', [group('Teal itinerary trim', path([[-182, 74], [-156, 100], [154, 100], [180, 74], [180, -106], [154, -132]], false, [[0, 0], [-14, 0], [0, 0], [0, 14], [0, 0], [14, 0]], [[0, 14], [0, 0], [14, 0], [0, 0], [0, -14], [0, 0]]), stroke(C.teal, 3), trim([[0, 0], [36, 0], [132, 100], [190, 100], [218, 0], [240, 0]]))]),
  layer('Route terminals', [dot('Origin ring', -182, 74, 13, C.mist), dot('Origin center', -182, 74, 5, C.teal), dot('Arrival halo', 154, -132, 24, C.mist), dot('Arrival core', 154, -132, 9, C.gold)]),
  layer('Parcel contact shadow', [group('Flat contact ellipse', ellipse(0, 0, 242, 24), fill(C.ink, 8))], transform([290, 430], { s: motion([[0, [100,100,100]], [54, [80,70,100]], [108, [100,100,100]], [196, [100,100,100]], [222, [96,90,100]], [240, [100,100,100]]]) })),
  layer('Order manifest / lifted paper', [group('Rounded manifest', rect(0, 0, 148, 178, 12), fill(C.paper), stroke(C.mist, 2)), tile('Manifest masthead', -22, -58, 66, 8, 4, C.teal), tile('Manifest status', 38, -58, 22, 8, 4, C.gold), line('Manifest divider', [[-50,-36],[50,-36]], C.mist, 2), ...[-15, 3, 21].flatMap((y, i) => [dot(`Manifest bullet ${i}`, -45, y, 5, C.gold), tile(`Manifest row ${i}`, -6, y, 54 + i*8, 5, 2.5, C.mist)]), tile('Manifest total', 24, 56, 50, 8, 4, C.ink)], transform([398, 229], { p: positions([[0,[398,241]], [22,[398,241]], [54,[407,208]], [82,[402,216]], [190,[402,216]], [222,[398,241]], [240,[398,241]]]), r: motion([[0,4],[54,10],[82,7],[190,7],[222,4],[240,4]]) })),
  layer('Hero parcel / folded top and shipping label', [
    group('Front panel', rect(0, 8, 236, 156, 10), fill(C.gold)),
    group('Folded lid', path([[-118,-65],[-88,-95],[88,-95],[118,-65]], true), fill(C.gold), stroke(C.paper, 1.5, 55)),
    group('Top tape', path([[-12,-95],[17,-95],[28,-65],[-7,-65]], true), fill(C.mist)),
    tile('Front tape', 10, -43, 35, 44, 0, C.mist),
    line('Lid seam', [[-113,-65],[113,-65]], C.ink, 1.5, 30),
    tile('Paper shipping label', -27, 18, 128, 76, 6, C.paper),
    tile('Label destination', -43, -5, 64, 6, 3, C.teal),
    tile('Label reference', -51, 9, 48, 3, 1.5, C.mist),
    ...barcode(-74, 35),
    line('Fold score', [[-100,67],[100,67]], C.ink, 1, 20),
    line('Handling up left', [[68,31],[68,4],[60,12],[68,4],[76,12]], C.ink, 2, 70),
    line('Handling up right', [[91,31],[91,4],[83,12],[91,4],[99,12]], C.ink, 2, 70),
    line('Handling baseline', [[59,39],[100,39]], C.ink, 2, 70),
  ], transform([292,334], { p: positions([[0,[292,342]],[18,[292,342]],[54,[284,310]],[78,[294,331]],[100,[292,326]],[186,[292,326]],[218,[292,345]],[232,[292,342]],[240,[292,342]]]), r: motion([[0,-3],[18,-3],[54,-7],[78,-1],[100,-3],[186,-3],[218,-2],[232,-3],[240,-3]]) })),
  layer('Route courier / moving mini parcel', [tile('Courier paper halo',0,0,32,32,8,C.paper), tile('Courier package',0,0,22,22,4,C.gold), tile('Courier tape',0,-3,5,16,1,C.paper)], transform([138,394], { p: positions([[0,[138,394]],[36,[138,394]],[56,[164,420]],[103,[474,420]],[114,[500,394]],[143,[500,214]],[154,[474,188]],[192,[474,188]],[218,[138,394]],[240,[138,394]]]), o: motion([[0,0],[30,0],[38,100],[170,100],[190,0],[240,0]]), r: motion([[0,0],[56,0],[114,-10],[154,0],[192,0],[218,0],[240,0]]) })),
  layer('Scan sweep / label verification', [line('Scanner line', [[-78,0],[27,0]], C.teal, 2), dot('Scanner head', 32, 0, 5, C.teal)], transform([292,334], { p: positions([[0,[292,333]],[76,[292,333]],[96,[292,368]],[118,[292,333]],[240,[292,333]]]), o: motion([[0,0],[76,0],[82,100],[108,100],[120,0],[240,0]]) })),
], [[0,'Rest / folded parcel'],[54,'Lift and manifest reveal'],[96,'Label scan'],[154,'Courier arrives'],[190,'Hold / dispatched'],[218,'Return to resting pose']]);

const receiptOutline = [[-77,-114],[77,-114],[77,102],[66,112],[55,102],[44,112],[33,102],[22,112],[11,102],[0,112],[-11,102],[-22,112],[-33,102],[-44,112],[-55,102],[-66,112],[-77,102]];
const badgePosition = positions([[0,[422,406]],[86,[422,406]],[112,[418,390]],[136,[418,396]],[190,[418,396]],[218,[422,406]],[240,[422,406]]]);
const badgeScale = scales([[0,82],[86,82],[112,110],[136,100],[190,100],[218,82],[240,82]]);
const badgeOpacity = motion([[0,0],[86,0],[102,100],[190,100],[218,0],[240,0]]);
const approved = base('Approved / a quiet payment confirmation', [
  ...sheet(),
  layer('Settlement orbit / quiet circular grid', [group('Outer orbit', ellipse(0,0,320), stroke(C.mist,1.5)), group('Inner orbit', ellipse(0,0,286), stroke(C.mist,1,50))], transform([319,312])),
  layer('Card contact shadow', [group('Flat floating shadow', ellipse(0,0,270,26), fill(C.ink,8))], transform([283,414], { s: motion([[0,[100,100,100]],[52,[85,70,100]],[96,[92,85,100]],[190,[92,85,100]],[226,[100,100,100]],[240,[100,100,100]]]) })),
  layer('Receipt / original serrated paper', [
    group('Scalloped cut receipt', path(receiptOutline,true), fill(C.paper), stroke(C.mist,2)),
    tile('Receipt heading',-16,-79,76,7,3.5,C.teal),
    tile('Receipt subheading',-29,-63,50,4,2,C.mist),
    line('Receipt perforation',[[-53,-42],[53,-42]],C.mist,1.5),
    ...[-18,3,24].flatMap((y,i) => [tile(`Receipt line item ${i}`, -20,y,66-i*9,5,2.5,C.mist),tile(`Receipt amount ${i}`,41,y,22,5,2.5,C.ink)]),
    line('Receipt sum rule',[[-53,46],[53,46]],C.mist,1.5),
    tile('Receipt total label',-30,65,44,6,3,C.ink),tile('Receipt total value',33,65,37,8,4,C.teal),
    dot('Receipt gold seal',-47,86,7,C.gold),tile('Receipt seal rule',-15,86,42,3,1.5,C.mist),
  ], transform([391,316], { p: positions([[0,[391,342]],[24,[391,342]],[64,[395,288]],[90,[393,298]],[190,[393,298]],[222,[391,342]],[240,[391,342]]]), r: motion([[0,5],[64,9],[90,6],[190,6],[222,5],[240,5]]) })),
  layer('Payment card / chip and account geometry', [
    tile('Teal card stock',0,0,258,166,18,C.teal),
    group('Inset perimeter',rect(0,0,238,146,12),stroke(C.paper,1,18)),
    tile('Issuer mark',-81,-48,48,7,3.5,C.paper),tile('Issuer submark',-88,-33,34,3,1.5,C.mist),
    tile('Gold chip',-82,3,39,30,6,C.gold),
    line('Chip center',[[-89,-12],[-89,18],[-76,18],[-76,-12]],C.paper,1.2,65),
    line('Chip conductor left',[[-101,3],[-89,3]],C.paper,1.2,65),line('Chip conductor right',[[-76,3],[-63,3]],C.paper,1.2,65),
    ...[-40,-13,14,41].map((x,i) => group(`Account group ${i+1}`, [ellipse(x,39,4),ellipse(x+7,39,4),ellipse(x+14,39,4)],fill(C.paper,85))),
    tile('Cardholder line',-63,61,78,4,2,C.mist),tile('Expiry line',56,61,31,4,2,C.mist),
    group('Payment emblem outline',ellipse(76,-43,27),stroke(C.paper,2,85)),dot('Payment emblem disc',94,-43,27,C.gold),
    line('Contactless one',[[68,-2],[72,3],[68,8]],C.paper,2,75),line('Contactless two',[[77,-7],[84,3],[77,13]],C.paper,2,75),
  ], transform([268,315], { p: positions([[0,[268,323]],[18,[268,323]],[54,[260,284]],[82,[270,299]],[106,[268,294]],[190,[268,294]],[222,[268,326]],[234,[268,323]],[240,[268,323]]]), r: motion([[0,-7],[18,-7],[54,-13],[82,-5],[106,-8],[190,-8],[222,-6],[234,-7],[240,-7]]) })),
  layer('Settlement status / geometric pill', [tile('Status capsule',0,0,174,28,14,C.mist),dot('Status dot',-65,0,8,C.teal),tile('Status rule',-12,0,72,4,2,C.teal),tile('Status end cap',54,0,22,4,2,C.paper)], transform([311,471], { o: motion([[0,35],[100,35],[140,100],[190,100],[226,35],[240,35]]) })),
  layer('Success badge / gold rim and paper inset', [dot('Gold backing',0,0,106,C.gold),dot('Teal badge',0,0,96,C.teal),dot('Paper inset',0,0,80,C.paper)], transform([422,406], { p:badgePosition,s:badgeScale,o:badgeOpacity })),
  layer('Confirmation flecks / restrained celebration', [line('North spark',[[0,-8],[0,-18]],C.gold,3),line('Diagonal spark',[[13,-3],[21,-8]],C.teal,3),dot('Orbit point',-14,-10,5,C.gold)], transform([459,349], { p: positions([[0,[452,358]],[100,[452,358]],[132,[464,341]],[180,[464,341]],[218,[452,358]],[240,[452,358]]]), o: motion([[0,0],[100,0],[116,100],[164,100],[190,0],[240,0]]) })),
  layer('Success check / two-leg trim, not a static icon', [group('Authored confirmation stroke',path([[-22,-1],[-6,15],[26,-19]]),stroke(C.teal,7),trim([[0,0],[94,0],[130,100],[190,100],[222,0],[240,0]]))], transform([422,406], { p:badgePosition,s:badgeScale,o:badgeOpacity })),
], [[0,'Rest / card poised'],[54,'Card lifts / receipt emerges'],[94,'Confirmation begins'],[112,'Badge overshoot'],[130,'Check fully drawn'],[190,'Verified hold'],[222,'Quiet reset']]);

for (const [id, data] of Object.entries({ dispatch, approved })) {
  await writeFile(new URL(`../apps/web/public/samples/${id}.json`, import.meta.url), JSON.stringify(data, null, 2) + '\n');
}
