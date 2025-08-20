function makePopupHtml(b){
  const name = b.name || b.type || 'Building';
  return `<div class="popup"><b>${name}</b></div>`;
}

export { makePopupHtml };
