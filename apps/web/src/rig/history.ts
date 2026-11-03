export type History<T> = { past: T[]; present: T; future: T[]; gesture: T | null };
const equal = <T>(a:T,b:T) => JSON.stringify(a)===JSON.stringify(b);
export const createHistory = <T>(present:T):History<T> => ({past:[],present,future:[],gesture:null});
export function commitHistory<T>(h:History<T>, present:T):History<T> {
 if(equal(h.present,present)) return h;
 return h.gesture ? {...h,present} : {past:[...h.past,h.present].slice(-100),present,future:[],gesture:null};
}
export const beginGesture = <T>(h:History<T>):History<T> => h.gesture ? h : {...h,gesture:h.present};
export function endGesture<T>(h:History<T>):History<T> {
 if(!h.gesture) return h;
 return equal(h.gesture,h.present) ? {...h,gesture:null} : {past:[...h.past,h.gesture].slice(-100),present:h.present,future:[],gesture:null};
}
export const cancelGesture = <T>(h:History<T>):History<T> => h.gesture ? {...h,present:h.gesture,gesture:null} : h;
export function undoHistory<T>(h:History<T>):History<T> {
 if(h.gesture) return cancelGesture(h);
 if(!h.past.length) return h;
 return {past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future],gesture:null};
}
export function redoHistory<T>(h:History<T>):History<T> {
 if(h.gesture||!h.future.length) return h;
 return {past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1),gesture:null};
}
