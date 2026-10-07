import {mountPersonalWorkspace} from './relay-personal-workspace.mjs';

// The source-pinned release remains null until deployment and backup approval.
mountPersonalWorkspace({root: document.getElementById('relay-personal-inbox')});
