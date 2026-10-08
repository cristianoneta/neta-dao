const links=[...document.querySelectorAll('[data-project-link]')];
const sections=[...document.querySelectorAll('[data-project]')];
function selectProject(){
  const requested=location.hash.slice(1),project=sections.some(s=>s.dataset.project===requested)?requested:'all';
  for(const section of sections)section.hidden=project!=='all'&&section.dataset.project!==project;
  for(const link of links){
    if(link.dataset.projectLink===project)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');
  }
}
addEventListener('hashchange',selectProject);selectProject();
