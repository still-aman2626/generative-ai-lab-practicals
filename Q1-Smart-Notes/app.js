(() => {
  'use strict';
  const KEY = 'stillnote-v1';
  const colors = ['#a8ad83','#9aa98f','#c4a78f','#91a6a2','#b69b9a','#a794bd','#c0b078'];
  const defaults = { folders: ['Personal', 'Work', 'Ideas'], notes: [] };
  let data = loadData();
  let view = 'all', activeFolder = '', sortMode = 'recent', editingId = null, isPinned = false, query = '';
  const $ = id => document.getElementById(id);
  const noteDialog = $('note-dialog'), folderDialog = $('folder-dialog');

  function loadData() {
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && Array.isArray(raw.notes) && Array.isArray(raw.folders)) return raw; }
    catch (e) { console.warn('Could not load saved notes', e); }
    return structuredClone(defaults);
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Could not save. Browser storage may be full.'); } }
  function escapeHTML(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function textExcerpt(content) { return content.trim().replace(/\s+/g, ' '); }
  function formatDate(timestamp) {
    const date = new Date(timestamp), now = new Date();
    if (date.toDateString() === now.toDateString()) return `Today, ${date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {month:'short',day:'numeric',year:date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined});
  }
  function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2300); }
  function notesForView() {
    let notes = [...data.notes];
    if (view === 'pinned') notes = notes.filter(n => n.pinned);
    if (view === 'folder') notes = notes.filter(n => n.folder === activeFolder);
    if (query) { const q=query.toLowerCase(); notes=notes.filter(n=>n.title.toLowerCase().includes(q)||n.content.toLowerCase().includes(q)||(n.tags||[]).some(t=>t.toLowerCase().includes(q))); }
    if (sortMode==='created') notes.sort((a,b)=>b.createdAt-a.createdAt);
    else if (sortMode==='title') notes.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    else notes.sort((a,b)=>b.updatedAt-a.updatedAt);
    return notes;
  }
  function renderFolders() {
    $('folder-list').innerHTML=data.folders.map((folder,i)=>`<button class="nav-item ${view==='folder'&&activeFolder===folder?'active':''}" data-folder="${escapeHTML(folder)}"><span class="nav-icon folder-glyph">▱</span><span class="folder-name">${escapeHTML(folder)}</span><span class="nav-count">${data.notes.filter(n=>n.folder===folder).length}</span></button>`).join('');
    $('folder-list').querySelectorAll('[data-folder]').forEach(btn=>btn.addEventListener('click',()=>{view='folder';activeFolder=btn.dataset.folder;render();}));
    $('all-count').textContent=data.notes.length; $('pinned-count').textContent=data.notes.filter(n=>n.pinned).length;
  }
  function card(note,index) {
    const tags=(note.tags||[]).slice(0,2).map(t=>`<span class="tag-chip">${escapeHTML(t)}</span>`).join('');
    return `<article class="note-card" data-note="${note.id}" style="--card-accent:${colors[index%colors.length]}"><div class="note-card-head"><span class="folder-chip">${escapeHTML(note.folder||'Personal')}</span>${note.pinned?'<span class="card-pin" title="Pinned">◆</span>':''}</div><h3>${escapeHTML(note.title||'Untitled note')}</h3><p class="note-excerpt">${escapeHTML(textExcerpt(note.content)||'No additional text')}</p><div class="note-card-foot"><span class="note-date">${formatDate(note.updatedAt)}</span><span class="tag-list">${tags}</span></div></article>`;
  }
  function render() {
    renderFolders();
    const filtered=notesForView();
    const isAll=view==='all'&&!query;
    let label=view==='pinned'?'Pinned':view==='folder'?activeFolder:'All notes';
    if(query) label='Search results';
    $('crumb-current').textContent=label;
    $('page-title').innerHTML=`${escapeHTML(label)}<span class="title-dot">.</span>`;
    $('page-eyebrow').textContent=query?'SEARCH YOUR NOTES':view==='folder'?'YOUR FOLDER':'YOUR PERSONAL SPACE';
    $('page-subtitle').textContent=query?`A little something for “${query}”.`:view==='pinned'?'The notes you want close at hand.':view==='folder'?`Everything tucked into ${activeFolder}.`:'A little room to think, plan, and remember.';
    $('results-label').textContent=`${filtered.length} ${filtered.length===1?'note':'notes'}`;
    $('pinned-section').classList.toggle('hidden',!isAll||!filtered.some(n=>n.pinned));
    $('notes-section-title').querySelector('span').textContent=view==='pinned'?'PINNED NOTES':view==='folder'?activeFolder.toUpperCase():query?'SEARCH RESULTS':'ALL NOTES';
    const pinned=isAll?filtered.filter(n=>n.pinned):[];
    const rest=isAll?filtered.filter(n=>!n.pinned):filtered;
    $('pinned-grid').innerHTML=pinned.map((n,i)=>card(n,i)).join('');
    $('notes-grid').innerHTML=rest.map((n,i)=>card(n,i+3)).join('');
    const noResults=filtered.length===0;
    $('empty-state').classList.toggle('hidden',!noResults);
    $('notes-section').classList.toggle('hidden',noResults);
    if(noResults){ $('empty-title').textContent=query?'Nothing found.':view==='pinned'?'Nothing pinned yet.':view==='folder'?'A little room to fill.':'A fresh page.'; $('empty-copy').textContent=query?'Try a different search, or create a note with this idea.':view==='pinned'?'Pin the notes you want to find quickly.':view==='folder'?`Add a note to ${activeFolder} when inspiration strikes.`:'Every good idea starts somewhere. Make your first note.'; }
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    document.querySelectorAll('.note-card').forEach(c=>c.addEventListener('click',()=>openNote(c.dataset.note)));
  }
  function openNote(id=null) {
    editingId=id; const note=id?data.notes.find(n=>n.id===id):null;
    $('note-title').value=note?.title||''; $('note-content').value=note?.content||'';
    $('note-folder').innerHTML=data.folders.map(f=>`<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`).join('')||'<option value="Personal">Personal</option>';
    const requestedFolder=note?.folder||(view==='folder'?activeFolder:data.folders[0]);
    if(requestedFolder&&!data.folders.includes(requestedFolder)){data.folders.push(requestedFolder);renderFolders();$('note-folder').innerHTML=data.folders.map(f=>`<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`).join('');}
    $('note-folder').value=requestedFolder||data.folders[0]; $('note-tags').value=(note?.tags||[]).join(', ');
    isPinned=!!note?.pinned; $('pin-note').classList.toggle('is-pinned',isPinned); $('pin-note').innerHTML=`${isPinned?'◆':'◇'} <span>${isPinned?'Pinned':'Pin'}</span>`;
    $('delete-note').classList.toggle('hidden',!note); $('save-status').textContent=note?'Saved note':'New note';
    noteDialog.showModal(); $('note-title').focus();
  }
  function saveNote(event) {
    event.preventDefault(); const title=$('note-title').value.trim(),content=$('note-content').value.trim();
    if(!title&&!content){noteDialog.close();return;}
    const now=Date.now(),tags=[...new Set($('note-tags').value.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean))];
    const note={id:editingId||`${now}-${Math.random().toString(36).slice(2,8)}`,title:title||'Untitled note',content,folder:$('note-folder').value||'Personal',tags,pinned:isPinned,createdAt:editingId?data.notes.find(n=>n.id===editingId).createdAt:now,updatedAt:now};
    if(editingId){data.notes[data.notes.findIndex(n=>n.id===editingId)]=note;toast('Your note has been updated.');}else{data.notes.push(note);toast('A new note, saved.');}
    if(!data.folders.includes(note.folder))data.folders.push(note.folder);
    persist();noteDialog.close();render();
  }
  $('new-note').addEventListener('click',()=>openNote()); $('heading-new').addEventListener('click',()=>openNote()); $('empty-new').addEventListener('click',()=>openNote());
  $('note-form').addEventListener('submit',saveNote);
  $('pin-note').addEventListener('click',()=>{isPinned=!isPinned;$('pin-note').classList.toggle('is-pinned',isPinned);$('pin-note').innerHTML=`${isPinned?'◆':'◇'} <span>${isPinned?'Pinned':'Pin'}</span>`;});
  $('delete-note').addEventListener('click',()=>{if(!editingId)return;data.notes=data.notes.filter(n=>n.id!==editingId);persist();noteDialog.close();render();toast('Note deleted.');});
  document.querySelector('.close-dialog').addEventListener('click',()=>noteDialog.close());
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.view;activeFolder='';render();}));
  document.querySelectorAll('[data-sort]').forEach(btn=>btn.addEventListener('click',()=>{sortMode=btn.dataset.sort;document.querySelectorAll('[data-sort]').forEach(b=>b.classList.toggle('selected',b===btn));render();}));
  $('search-input').addEventListener('input',e=>{query=e.target.value.trim();render();});
  $('add-folder').addEventListener('click',()=>{ $('folder-name').value='';folderDialog.showModal();$('folder-name').focus(); });
  $('folder-form').addEventListener('submit',e=>{e.preventDefault();const name=$('folder-name').value.trim();if(!name)return;if(data.folders.some(f=>f.toLowerCase()===name.toLowerCase())){toast('That folder already exists.');return;}data.folders.push(name);persist();folderDialog.close();render();toast(`${name} folder created.`);});
  $('cancel-folder').addEventListener('click',()=>folderDialog.close());document.querySelector('.close-folder').addEventListener('click',()=>folderDialog.close());
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search-input').focus();}if(e.key.toLowerCase()==='n'&&!noteDialog.open&&!folderDialog.open&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();openNote();}});
  render();
})();
