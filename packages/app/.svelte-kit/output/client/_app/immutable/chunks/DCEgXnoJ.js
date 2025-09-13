var Je=Object.defineProperty;var Be=t=>{throw TypeError(t)};var Qe=(t,e,s)=>e in t?Je(t,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[e]=s;var le=(t,e,s)=>Qe(t,typeof e!="symbol"?e+"":e,s),Le=(t,e,s)=>e.has(t)||Be("Cannot "+s);var k=(t,e,s)=>(Le(t,e,"read from private field"),s?s.call(t):e.get(t)),Z=(t,e,s)=>e.has(t)?Be("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,s);var Ce=(t,e,s)=>(Le(t,e,"access private method"),s);import"./f00okDMd.js";import{s as Ae,a as Ke}from"./DxYQc54M.js";import{at as Xe,b6 as Ye,bc as et,h as R,g as r,m as M,p as H,e as E,a as N,b as f,c as O,f as U,S as tt,s as x,d as F,l as se,r as q,Q as he,t as Se,n as Q,u as rt,v as ae}from"./CcupEzEf.js";import{p as _,i as oe,r as K,s as re,c as ue}from"./BVPmkM9x.js";import{I as ce,B as fe,a as Oe,i as st}from"./di3RH49S.js";import{r as He,a as Ne,c as nt,s as at,e as it,d as ot,g as ct}from"./DasDILl7.js";import"./D8ieNkJn.js";import{s as te}from"./cfBV56z_.js";import{a as dt,l as lt,h as ut,n as ht,o as ft,p as gt,c as mt,m as Ue,s as vt,d as pt,b as T}from"./CguayBz6.js";import{C as Ve,w as ze,E as bt,S as kt,c as _t,I as xt}from"./BA9JEYNq.js";import"./D7zXso-X.js";import{i as yt}from"./SsqNf5DL.js";import{C as wt}from"./COiSFdZj.js";import{D as Pt,a as Ct,R as St,b as Mt}from"./CQtLCgFB.js";const Rt=[];function At(t,e=!1,s=!1){return Me(t,new Map,"",Rt,null,s)}function Me(t,e,s,n,a=null,u=!1){if(typeof t=="object"&&t!==null){var i=e.get(t);if(i!==void 0)return i;if(t instanceof Map)return new Map(t);if(t instanceof Set)return new Set(t);if(Xe(t)){var l=Array(t.length);e.set(t,l),a!==null&&e.set(a,l);for(var v=0;v<t.length;v+=1){var y=t[v];v in t&&(l[v]=Me(y,e,s,n,null,u))}return l}if(Ye(t)===et){l={},e.set(t,l),a!==null&&e.set(a,l);for(var g in t)l[g]=Me(t[g],e,s,n,null,u);return l}if(t instanceof Date)return structuredClone(t);if(typeof t.toJSON=="function"&&!u)return Me(t.toJSON(),e,s,n,t)}if(t instanceof EventTarget)return t;try{return structuredClone(t)}catch{return t}}const Dt=mt({component:"checkbox",parts:["root","group","group-label","input"]}),Nt=new Ve("Checkbox.Group"),We=new Ve("Checkbox.Root");var ge,me,ve,pe,ie,Re,be,ke;const Ie=class Ie{constructor(e,s){Z(this,ie);le(this,"opts");le(this,"group");Z(this,ge,R(()=>this.group&&this.group.opts.name.current?this.group.opts.name.current:this.opts.name.current));Z(this,me,R(()=>this.group&&this.group.opts.required.current?!0:this.opts.required.current));Z(this,ve,R(()=>this.group&&this.group.opts.disabled.current?!0:this.opts.disabled.current));Z(this,pe,R(()=>this.group&&this.group.opts.readonly.current?!0:this.opts.readonly.current));le(this,"attachment");Z(this,be,R(()=>({checked:this.opts.checked.current,indeterminate:this.opts.indeterminate.current})));Z(this,ke,R(()=>({id:this.opts.id.current,role:"checkbox",type:this.opts.type.current,disabled:this.trueDisabled,"aria-checked":gt(this.opts.checked.current,this.opts.indeterminate.current),"aria-required":ft(this.trueRequired),"aria-readonly":ht(this.trueReadonly),"data-disabled":ut(this.trueDisabled),"data-readonly":lt(this.trueReadonly),"data-state":zt(this.opts.checked.current,this.opts.indeterminate.current),[Dt.root]:"",onclick:this.onclick,onkeydown:this.onkeydown,...this.attachment})));this.opts=e,this.group=s,this.attachment=dt(this.opts.ref),this.onkeydown=this.onkeydown.bind(this),this.onclick=this.onclick.bind(this),ze.pre([()=>{var n;return At((n=this.group)==null?void 0:n.opts.value.current)},()=>this.opts.value.current],([n,a])=>{!n||!a||(this.opts.checked.current=n.includes(a))}),ze.pre(()=>this.opts.checked.current,n=>{var a,u;this.group&&(n?(a=this.group)==null||a.addValue(this.opts.value.current):(u=this.group)==null||u.removeValue(this.opts.value.current))})}static create(e,s=null){return We.set(new Ie(e,s))}get trueName(){return r(k(this,ge))}set trueName(e){M(k(this,ge),e)}get trueRequired(){return r(k(this,me))}set trueRequired(e){M(k(this,me),e)}get trueDisabled(){return r(k(this,ve))}set trueDisabled(e){M(k(this,ve),e)}get trueReadonly(){return r(k(this,pe))}set trueReadonly(e){M(k(this,pe),e)}onkeydown(e){this.trueDisabled||this.trueReadonly||(e.key===bt&&e.preventDefault(),e.key===kt&&(e.preventDefault(),Ce(this,ie,Re).call(this)))}onclick(e){if(!(this.trueDisabled||this.trueReadonly)){if(this.opts.type.current==="submit"){Ce(this,ie,Re).call(this);return}e.preventDefault(),Ce(this,ie,Re).call(this)}}get snippetProps(){return r(k(this,be))}set snippetProps(e){M(k(this,be),e)}get props(){return r(k(this,ke))}set props(e){M(k(this,ke),e)}};ge=new WeakMap,me=new WeakMap,ve=new WeakMap,pe=new WeakMap,ie=new WeakSet,Re=function(){this.opts.indeterminate.current?(this.opts.indeterminate.current=!1,this.opts.checked.current=!0):this.opts.checked.current=!this.opts.checked.current},be=new WeakMap,ke=new WeakMap;let $e=Ie;var _e,xe,ye;const Fe=class Fe{constructor(e){le(this,"root");Z(this,_e,R(()=>this.root.group?!!(this.root.opts.value.current!==void 0&&this.root.group.opts.value.current.includes(this.root.opts.value.current)):this.root.opts.checked.current));Z(this,xe,R(()=>!!this.root.trueName));Z(this,ye,R(()=>({type:"checkbox",checked:this.root.opts.checked.current===!0,disabled:this.root.trueDisabled,required:this.root.trueRequired,name:this.root.trueName,value:this.root.opts.value.current,readonly:this.root.trueReadonly})));this.root=e}static create(){return new Fe(We.get())}get trueChecked(){return r(k(this,_e))}set trueChecked(e){M(k(this,_e),e)}get shouldRender(){return r(k(this,xe))}set shouldRender(e){M(k(this,xe),e)}get props(){return r(k(this,ye))}set props(e){M(k(this,ye),e)}};_e=new WeakMap,xe=new WeakMap,ye=new WeakMap;let qe=Fe;function zt(t,e){return e?"indeterminate":t?"checked":"unchecked"}var $t=U("<input/>"),qt=U("<input/>");function It(t,e){H(e,!0);let s=_(e,"value",15),n=K(e,["$$slots","$$events","$$legacy","value"]);const a=R(()=>Ue(n,{"aria-hidden":"true",tabindex:-1,style:vt}));var u=E(),i=N(u);{var l=y=>{var g=$t();He(g),Ne(g,()=>({...r(a),value:s()})),f(y,g)},v=y=>{var g=qt();He(g),Ne(g,()=>({...r(a)})),_t(g,s),f(y,g)};oe(i,y=>{r(a).type==="checkbox"?y(l):y(v,!1)})}f(t,u),O()}function Ft(t,e){H(e,!1);const s=qe.create();yt();var n=E(),a=N(n);{var u=i=>{It(i,re(()=>s.props))};oe(a,i=>{s.shouldRender&&i(u)})}f(t,n),O()}var Et=U("<button><!></button>"),Bt=U("<!> <!>",1);function Lt(t,e){const s=tt();H(e,!0);let n=_(e,"checked",15,!1),a=_(e,"ref",15,null),u=_(e,"disabled",3,!1),i=_(e,"required",3,!1),l=_(e,"name",3,void 0),v=_(e,"value",3,"on"),y=_(e,"id",19,()=>pt(s)),g=_(e,"indeterminate",15,!1),w=_(e,"type",3,"button"),p=K(e,["$$slots","$$events","$$legacy","checked","ref","onCheckedChange","children","disabled","required","name","value","id","indeterminate","onIndeterminateChange","child","type","readonly"]);const B=Nt.getOr(null);B&&v()&&(B.opts.value.current.includes(v())?n(!0):n(!1)),ze.pre(()=>v(),()=>{B&&v()&&(B.opts.value.current.includes(v())?n(!0):n(!1))});const I=$e.create({checked:T.with(()=>n(),d=>{var c;n(d),(c=e.onCheckedChange)==null||c.call(e,d)}),disabled:T.with(()=>u()??!1),required:T.with(()=>i()),name:T.with(()=>l()),value:T.with(()=>v()),id:T.with(()=>y()),ref:T.with(()=>a(),d=>a(d)),indeterminate:T.with(()=>g(),d=>{var c;g(d),(c=e.onIndeterminateChange)==null||c.call(e,d)}),type:T.with(()=>w()),readonly:T.with(()=>!!e.readonly)},B),G=R(()=>Ue({...p},I.props));var V=Bt(),X=N(V);{var $=d=>{var c=E(),m=N(c);{let A=R(()=>({props:r(G),...I.snippetProps}));te(m,()=>e.child,()=>r(A))}f(d,c)},Y=d=>{var c=Et();Ne(c,()=>({...r(G)}));var m=F(c);te(m,()=>e.children??se,()=>I.snippetProps),q(c),f(d,c)};oe(X,d=>{e.child?d($):d(Y,!1)})}var o=x(X,2);Ft(o,{}),f(t,V),O()}function Ht(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"m6 9 6 6 6-6"}]];ce(t,re({name:"chevron-down"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}function Ot(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z"}],["path",{d:"M12 17.66L12 22"}]];ce(t,re({name:"club"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}function Ut(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"}]];ce(t,re({name:"diamond"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}function Vt(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"}]];ce(t,re({name:"heart"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}function Wt(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M5 12h14"}]];ce(t,re({name:"minus"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}function Zt(t,e){H(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */let s=K(e,["$$slots","$$events","$$legacy"]);const n=[["path",{d:"M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z"}],["path",{d:"M12 18v4"}]];ce(t,re({name:"spade"},()=>s,{get iconNode(){return n},children:(a,u)=>{var i=E(),l=N(i);te(l,()=>e.children??se),f(a,i)},$$slots:{default:!0}})),O()}var Gt=U('<div data-slot="checkbox-indicator" class="text-current transition-none"><!></div>');function De(t,e){H(e,!0);let s=_(e,"ref",15,null),n=_(e,"checked",15,!1),a=_(e,"indeterminate",15,!1),u=K(e,["$$slots","$$events","$$legacy","ref","checked","indeterminate","class"]);var i=E(),l=N(i);{const v=(g,w)=>{let p=()=>w==null?void 0:w().checked,B=()=>w==null?void 0:w().indeterminate;var I=Gt(),G=F(I);{var V=$=>{wt($,{class:"size-3.5"})},X=$=>{var Y=E(),o=N(Y);{var d=c=>{Wt(c,{class:"size-3.5"})};oe(o,c=>{B()&&c(d)},!0)}f($,Y)};oe(G,$=>{p()?$(V):$(X,!1)})}q(I),f(g,I)};let y=R(()=>nt("border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",e.class));ue(l,()=>Lt,(g,w)=>{w(g,re({"data-slot":"checkbox",get class(){return r(y)}},()=>u,{get ref(){return s()},set ref(p){s(p)},get checked(){return n()},set checked(p){n(p)},get indeterminate(){return a()},set indeterminate(p){a(p)},children:v,$$slots:{default:!0}}))})}f(t,i),O()}var Tt=U(" <!>",1),jt=U("<!> <!>",1),Jt=U('<div class="bg-background flex items-center gap-4 rounded-lg border p-4"><div class="flex items-center gap-2"><label class="text-sm font-medium">Paper size:</label> <!></div> <div class="flex items-center gap-2"><label class="text-sm font-medium">Orientation:</label> <!></div> <div class="flex items-center gap-2"><!> <label class="text-sm font-medium">Fronts</label></div> <div class="flex items-center gap-2"><!> <label class="text-sm font-medium">Backs</label></div> <div class="flex items-center gap-2"><!> <label class="text-sm font-medium">Crop marks</label></div> <div class="flex items-center gap-2"><label class="text-sm font-medium">Margin (mm):</label> <!></div> <!></div>');function Qt(t,e){H(e,!0);let s=_(e,"paperSize",15,"A4"),n=_(e,"orientation",15,"Portrait"),a=_(e,"fronts",15,!0),u=_(e,"backs",15,!1),i=_(e,"margin",15,10),l=_(e,"cropMarks",15,!1);const v=["A3","A4","A5","US Letter","US Legal"];function y(){n(n()==="Portrait"?"Landscape":"Portrait")}function g(){window.print()}var w=Jt(),p=F(w),B=x(F(p),2);ue(B,()=>St,(h,D)=>{D(h,{children:(P,b)=>{var C=jt(),S=N(C);ue(S,()=>Pt,(W,z)=>{z(W,{asChild:!0,children:(ee,we)=>{fe(ee,{variant:"outline",class:"min-w-[120px] justify-between",children:(ne,de)=>{Q();var L=Tt(),J=N(L),Pe=x(J);Ht(Pe,{class:"size-4"}),Se(()=>Ae(J,`${s()??""} `)),f(ne,L)},$$slots:{default:!0}})},$$slots:{default:!0}})});var j=x(S,2);ue(j,()=>Ct,(W,z)=>{z(W,{children:(ee,we)=>{var ne=E(),de=N(ne);Oe(de,16,()=>v,L=>L,(L,J)=>{var Pe=E(),Ze=N(Pe);ue(Ze,()=>Mt,(Ge,Te)=>{Te(Ge,{onclick:()=>s(J),children:(je,tr)=>{Q();var Ee=he();Se(()=>Ae(Ee,J)),f(je,Ee)},$$slots:{default:!0}})}),f(L,Pe)}),f(ee,ne)},$$slots:{default:!0}})}),f(P,C)},$$slots:{default:!0}})}),q(p);var I=x(p,2),G=x(F(I),2);fe(G,{variant:"outline",onclick:y,children:(h,D)=>{Q();var P=he();Se(()=>Ae(P,`${n()??""}
			⇄`)),f(h,P)},$$slots:{default:!0}}),q(I);var V=x(I,2),X=F(V);De(X,{get checked(){return a()},set checked(h){a(h)}}),Q(2),q(V);var $=x(V,2),Y=F($);De(Y,{get checked(){return u()},set checked(h){u(h)}}),Q(2),q($);var o=x($,2),d=F(o);De(d,{get checked(){return l()},set checked(h){l(h)}}),Q(2),q(o);var c=x(o,2),m=x(F(c),2);xt(m,{type:"number",min:"0",max:"50",class:"w-20",get value(){return i()},set value(h){i(h)}}),q(c);var A=x(c,2);fe(A,{onclick:g,class:"ml-auto",children:(h,D)=>{Q();var P=he("Print");f(h,P)},$$slots:{default:!0}}),q(w),f(t,w),O()}var Kt=U(`<div class="flex flex-col items-center justify-center px-4 py-16 text-center"><div class="mb-6 flex items-center gap-2"><!> <!> <!> <!></div> <h3 class="mb-3 text-2xl font-semibold">Select cards to print</h3> <p class="text-muted-foreground mb-8 max-w-md text-lg">Choose which sides of your cards you'd like to include in the print layout.</p> <div class="flex gap-3"><!> <!></div></div>`),Xt=U("<div></div>"),Yt=U('<div class="sheets"></div>'),er=U('<div class="mx-4 flex flex-col gap-4"><!> <!></div>');function pr(t,e){H(e,!0);let s=ae("A4"),n=ae("Portrait"),a=ae(!0),u=ae(!1),i=ae(10),l=ae(!1);const v={A3:{width:297,height:420},A4:{width:210,height:297},A5:{width:148,height:210},"US Letter":{width:216,height:279},"US Legal":{width:216,height:356}},y=R(()=>()=>{const o=v[r(s)];return r(n)==="Portrait"?{width:`${o.width}mm`,height:`${o.height}mm`}:{width:`${o.height}mm`,height:`${o.width}mm`}});function g(o,d){const c=v[r(s)],m=r(n)==="Portrait"?c.width:c.height,A=r(n)==="Portrait"?c.height:c.width,h=m-r(i)*2,D=A-r(i)*2,P=parseFloat(o.replace("mm","")),b=parseFloat(d.replace("mm","")),C=Math.floor(h/P),S=Math.floor(D/b);return{horizontal:C,vertical:S,total:C*S}}const w=R(()=>()=>{const o=[];return e.projects.forEach(d=>{var D,P;const c=((D=d.svgsFront[0])==null?void 0:D.width.baseVal.valueAsString)||"63mm",m=((P=d.svgsFront[0])==null?void 0:P.height.baseVal.valueAsString)||"89mm",A=g(c,m),h=A.total;if(r(a)&&r(u)){const b=d.svgsFront,C=d.svgsBack,S=Math.ceil(b.length/h),j=Math.ceil(C.length/h),W=S+j,z=Array.from({length:W},(ee,we)=>{const ne=we%2===0,de=Math.floor(we/2);if(ne){const L=de*h,J=Math.min(L+h,b.length);return{svgs:b.slice(L,J),width:c,height:m,fitCalculation:A}}else{const L=de*h,J=Math.min(L+h,C.length);return{svgs:C.slice(L,J),width:c,height:m,fitCalculation:A}}});o.push(...z)}else if(r(a)){const b=d.svgsFront,C=Math.ceil(b.length/h),S=Array.from({length:C},(j,W)=>{const z=W*h,ee=Math.min(z+h,b.length);return{svgs:b.slice(z,ee),width:c,height:m,fitCalculation:A}});o.push(...S)}else if(r(u)){const b=d.svgsBack,C=Math.ceil(b.length/h),S=Array.from({length:C},(j,W)=>{const z=W*h,ee=Math.min(z+h,b.length);return{svgs:b.slice(z,ee),width:c,height:m,fitCalculation:A}});o.push(...S)}}),o});let p;rt(()=>{B(r(s),r(n),r(i))});function B(o,d,c){p&&(p.textContent=`
			@page {
				size: ${o} ${d.toLowerCase()};
                margin: 0mm;
			}
		`)}function I(o){return d=>(o.forEach(c=>d.appendChild(c)),()=>o.forEach(c=>d.removeChild(c)))}Ke(()=>(p=document.createElement("style"),p.media="print",document.head.appendChild(p),B(r(s),r(n),r(i)),()=>p.remove()));var G=er(),V=F(G);Qt(V,{get paperSize(){return r(s)},set paperSize(o){M(s,o,!0)},get orientation(){return r(n)},set orientation(o){M(n,o,!0)},get fronts(){return r(a)},set fronts(o){M(a,o,!0)},get backs(){return r(u)},set backs(o){M(u,o,!0)},get margin(){return r(i)},set margin(o){M(i,o,!0)},get cropMarks(){return r(l)},set cropMarks(o){M(l,o,!0)}});var X=x(V,2);{var $=o=>{var d=Kt(),c=F(d),m=F(c);Ot(m,{class:"h-8 w-8 fill-gray-800 text-gray-800"});var A=x(m,2);Vt(A,{class:"h-8 w-8 fill-red-500 text-red-500"});var h=x(A,2);Zt(h,{class:"h-8 w-8 fill-gray-800 text-gray-800"});var D=x(h,2);Ut(D,{class:"h-8 w-8 fill-red-500 text-red-500"}),q(c);var P=x(c,6),b=F(P);{let S=R(()=>r(a)?"default":"outline");fe(b,{get variant(){return r(S)},onclick:()=>M(a,!r(a)),children:(j,W)=>{Q();var z=he("Print Front Sides");f(j,z)},$$slots:{default:!0}})}var C=x(b,2);{let S=R(()=>r(u)?"default":"outline");fe(C,{get variant(){return r(S)},onclick:()=>M(u,!r(u)),children:(j,W)=>{Q();var z=he("Print Back Sides");f(j,z)},$$slots:{default:!0}})}q(P),q(d),f(o,d)},Y=o=>{var d=Yt();Oe(d,21,()=>r(w)(),st,(c,m,A,h)=>{var D=Xt();let P;at(D,"id",`con-${A}`);let b;it(D,()=>I(r(m).svgs)),Se((C,S)=>{P=ot(D,1,"sheet border border-gray-300 svelte-hr14h",null,P,C),b=ct(D,"",b,S)},[()=>({"crop-marks":r(l)}),()=>({width:r(y)().width,height:r(y)().height,"grid-template-columns":`repeat(${r(m).fitCalculation.horizontal}, ${r(m).width})`,"--svg-w":r(m).width,"--svg-h":r(m).height,padding:`${r(i)}mm`,"--margin":`${r(i)}mm`})]),f(c,D)}),q(d),f(o,d)};oe(X,o=>{!r(a)&&!r(u)?o($):o(Y,!1)})}q(G),f(t,G),O()}export{pr as E};
