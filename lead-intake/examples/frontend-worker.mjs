// Use as the existing static Astro site's Worker entry, or wrap its existing handler once.
import config from '../frontend-config.mjs';
import {handleLeadRequest} from '../src/frontend.mjs';
export default {
  fetch(request,env,ctx) {
    return handleLeadRequest(request,{...config,INTAKE:env.INTAKE},ctx,()=>env.ASSETS.fetch(request));
  },
};
