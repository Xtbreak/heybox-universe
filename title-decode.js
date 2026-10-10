export function createTitleDecode({ root=document }={}) {
  const titles=[...root.querySelectorAll('.frame h1,.frame h2')];
  const originals=new Map(),jobs=new Map();let quality='standard',reduced=false,active=null,frame=0,disposed=false;
  const symbols='01◇△▱/░<>_';
  for(const title of titles){
    const walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push({node:walker.currentNode,text:walker.currentNode.textContent});
    originals.set(title,nodes);title.setAttribute('aria-label',title.textContent.trim());
  }
  function restore(title){for(const item of originals.get(title)||[])item.node.textContent=item.text;title.classList.remove('decoding');jobs.delete(title);}
  function tick(now){
    frame=0;
    for(const [title,start] of jobs){
      const p=Math.min(1,(now-start)/640),items=originals.get(title);let offset=0;
      const length=items.reduce((n,item)=>n+[...item.text].length,0);
      for(const item of items)item.node.textContent=[...item.text].map(char=>{
        const at=offset++;return /\s|[，。！]/.test(char)||at/Math.max(1,length)<p?char:symbols[(Math.floor(now/55)+at*7)%symbols.length];
      }).join('');
      if(p>=1)restore(title);
    }
    if(jobs.size)frame=requestAnimationFrame(tick);
  }
  function settings(nextQuality,nextReduced){quality=nextQuality;reduced=nextReduced;if(quality!=='ultra'||reduced){cancelAnimationFrame(frame);frame=0;for(const title of [...jobs.keys()])restore(title);}}
  return {
    settings,
    show(section){
      if(disposed||active===section)return;active=section;
      if(quality!=='ultra'||reduced)return;
      const title=section?.querySelector('h1,h2');if(!originals.has(title))return;
      jobs.set(title,performance.now());title.classList.add('decoding');if(!frame)frame=requestAnimationFrame(tick);
    },
    dispose(){disposed=true;cancelAnimationFrame(frame);for(const title of originals.keys())restore(title);originals.clear();jobs.clear();}
  };
}
