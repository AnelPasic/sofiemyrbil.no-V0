import {z} from 'astro/zod';
import type {BuilderPage,GlobalMasters} from '../page-builder';
const text=z.string().trim().min(1);
const item=z.object({id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),displayName:text,metric:text,context:text,publicationApproved:z.boolean(),namePermission:z.boolean(),evidenceVerified:z.boolean()}).strict();
export const heroProofCasesSchema=z.array(item).superRefine((items,ctx)=>{
 if(new Set(items.map(x=>x.id)).size!==items.length)ctx.addIssue({code:'custom',message:'Duplicate proof case ID'});
});
export type HeroProofCase=z.infer<typeof item>;
export function resolveHeroProof(hero:BuilderPage['hero'],masters:GlobalMasters,cases:readonly HeroProofCase[]){
 if(!hero.featuredProofCaseId)return undefined;
 if(hero.visual.kind!=='image')throw new Error('Featured Hero proof requires a visible image');
 const slot=masters.proof;
 if(!slot||slot.type!=='protected'||slot.renderKey!=='proof'||!slot.publicationApproved)throw new Error('Featured Hero proof requires the approved proof slot');
 const selected=cases.find(x=>x.id===hero.featuredProofCaseId);
 if(!selected||!selected.publicationApproved||!selected.namePermission||!selected.evidenceVerified)throw new Error('Hero proof requires case permission and evidence: '+hero.featuredProofCaseId);
 return selected;
}
