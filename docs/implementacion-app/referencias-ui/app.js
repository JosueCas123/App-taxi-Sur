/* TaxiSur driver prototype — fictitious data only. No GPS, authentication or API calls. */
(() => {
  'use strict';
  const KEY = 'taxisur-driver-ui-v1';
  const page = document.body.dataset.page;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const go = (p) => { location.href = p + '.html'; };
  const fixture = {name:'Carlos Mendoza',ci:'6742381 LP',phone:'70000000',plate:'2847 ABC',brand:'Toyota',model:'Corolla',color:'Blanco',capacity:4};
  const makeRequest = (active=false) => ({id:'TS-0248',status:active?'active':'pending',deadline:Date.now()+60000,acceptedAt:active?Date.now():null,destination:'Plaza Abaroa, Sopocachi'});
  function base() { return {version:1,auth:false,account:'aprobado',shift:false,available:false,location:'unknown',locationAt:0,manualStale:false,network:true,request:null,lastRequest:null,closeAfter:false,profile:{...fixture}}; }
  function scene(key) {
    const x=base();
    x.auth=!['bienvenida','login','registro','recuperar-pin','catalog'].includes(key);
    if (key==='cuenta-en-revision') x.account='pendiente';
    if (key==='cuenta-rechazada') x.account='rechazado';
    if (key==='cuenta-suspendida') x.account='suspendido';
    if (['solicitud-entrante','solicitud-expirada','en-servicio','servicio-finalizado','ubicacion-desactualizada','sin-conexion'].includes(key)) {
      x.shift=true; x.location='granted'; x.locationAt=Date.now();
    }
    if (key==='solicitud-entrante') x.request=makeRequest();
    if (key==='en-servicio') x.request=makeRequest(true);
    if (key==='solicitud-expirada') {x.lastRequest={...makeRequest(),status:'expired'};x.available=true;}
    if (key==='servicio-finalizado') {x.lastRequest={...makeRequest(true),status:'finished'};x.available=true;}
    if (key==='ubicacion-desactualizada') {x.manualStale=true;x.locationAt=Date.now()-360000;}
    if (key==='sin-conexion') x.network=false;
    return x;
  }
  let state;
  let storageAvailable = true;
  try { const data=JSON.parse(localStorage.getItem(KEY)); if(data?.version===1 && data.profile) state=data; } catch (_) { storageAvailable=false; }
  const preview = new URLSearchParams(location.search).has('vista');
  if (!state || preview) state=scene(page);
  if(preview){try{history.replaceState(null,'',location.pathname);}catch(_){/* file URL may restrict history; navigation still works */}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){storageAvailable=false;}}
  save();
  let busy=false, toastTimer, modalAction=null, timerWarning=false;
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4400);}
  function notifyInline(selector,message){const el=$(selector);if(el)el.textContent=message;else toast(message);}
  function openDialog(title,copy,confirm,callback,secondary='Volver',secondaryAction=null){
    const d=$('#dialog');
    d.innerHTML=`<div class="iconbox yellow"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg></div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(copy)}</p><div class="actions"><button class="btn primary" type="button" id="dialog-confirm">${esc(confirm)}</button><button class="btn" type="button" id="dialog-cancel">${esc(secondary)}</button></div>`;
    modalAction=callback;
    $('#dialog-confirm').onclick=()=>{d.close();const fn=modalAction;modalAction=null;if(fn)fn();};
    $('#dialog-cancel').onclick=()=>{d.close();modalAction=null;if(secondaryAction)secondaryAction();};
    d.showModal();$('#dialog-cancel').focus();
  }
  function allowed(){return state.auth&&state.account==='aprobado';}
  function validLocation(){return state.location==='granted' && Date.now()-state.locationAt<=300000 && !state.manualStale;}
  function eligible(){return allowed()&&state.shift&&validLocation()&&state.network&&!state.request&&!state.closeAfter;}
  function accountRoute(){return ({pendiente:'cuenta-en-revision',rechazado:'cuenta-rechazada',suspendido:'cuenta-suspendida'})[state.account]||'inicio';}
  function currentRoute(){if(!state.auth)return 'login';if(state.account!=='aprobado')return accountRoute();if(state.request)return state.request.status==='active'?'en-servicio':'solicitud-entrante';return 'inicio';}
  function expire(){
    if(state.request?.status!=='pending'||state.request.deadline>Date.now())return false;
    state.lastRequest={...state.request,status:'expired'};state.request=null;state.available=eligible();save();
    if(page==='solicitud-entrante'){go('solicitud-expirada');return true;}
    if(page==='inicio') renderHome();return true;
  }
  expire();
  const publicPages=['catalog','bienvenida','login','registro','recuperar-pin'];
  if(!publicPages.includes(page)) {
    if(!state.auth){go('login');return;}
    if(state.account!=='aprobado' && !['perfil',accountRoute()].includes(page)){go(accountRoute());return;}
    if(state.account==='aprobado' && ['cuenta-en-revision','cuenta-rechazada','cuenta-suspendida'].includes(page)){go('inicio');return;}
    if(page==='solicitud-entrante'&&!state.request){go(state.lastRequest?.status==='expired'?'solicitud-expirada':'inicio');return;}
    if(page==='solicitud-entrante'&&state.request?.status==='active'){go('en-servicio');return;}
    if(page==='en-servicio'&&state.request?.status!=='active'){go(currentRoute());return;}
  }
  const note=(text,kind='blue')=>`<div class="notice ${kind}"><div>${text}</div></div>`;
  const actionLink=(label,path)=>`<a class="btn primary" href="${path}.html">${label} →</a>`;
  function renderBindings(){
    const p=state.profile, initials=p.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    const req=state.request||state.lastRequest;
    const values={'first-name':p.name.split(' ')[0],'full-name':p.name,'initials':initials,'ci':p.ci,'phone':'+591 '+p.phone,'plate':p.plate,'vehicle':`${p.brand} ${p.model} · ${p.color}`,'capacity':p.capacity,'request-id':req?.id||'TS-0248','destination':req?.destination||'Destino por confirmar','destination-note':req?.destination?'La Paz':'El destino es opcional; no impide aceptar.'};
    $$('[data-bind]').forEach(el=>{el.textContent=values[el.dataset.bind]??'';});
    const b=$('#offline-banner');if(b)b.hidden=state.network||page==='sin-conexion';
  }
  function renderHome(){
    if(!$('#home-state'))return;
    let status='No disponible',kind='',title='Tu jornada empieza aquí.',desc='Inicia tu jornada cuando estés listo para trabajar.';
    if(state.shift){title='Tú marcas el ritmo.';desc='Activa tu disponibilidad para recibir solicitudes.';}
    if(state.available&&eligible()){status='Disponible';kind='green';title='Listo para tu próxima ruta.';desc='La central puede conectarte con solicitudes cercanas.';}
    if(state.request?.status==='pending'){status='Solicitud pendiente';kind='yellow';title='Tienes una nueva solicitud.';desc='Revisa la recogida y responde antes de que termine el tiempo.';}
    if(state.request?.status==='active'){status='En servicio';kind='blue';title='Un recorrido en marcha.';desc=state.closeAfter?'Completa este servicio. Tu jornada se cerrará al finalizar.':'Tienes un servicio activo. No recibirás otras solicitudes.';}
    $('#home-state').textContent=status;$('#home-state').className='badge '+kind;
    $('#home-title').textContent=title;$('#home-description').textContent=desc;
    $('#shift-label').textContent=state.closeAfter?'Cierre de jornada solicitado':state.shift?'Finalizar jornada':'Iniciar jornada';
    $('#shift-help').textContent=state.closeAfter?'Se cerrará al completar tu servicio.':state.shift?'Tu jornada de trabajo está activa.':'Activa tu día de trabajo.';
    $('#shift-switch').setAttribute('aria-checked',String(state.shift));
    $('#shift-switch').disabled=busy||!state.network||state.request?.status==='pending'||state.closeAfter;
    const a=$('#availability-switch');a.setAttribute('aria-checked',String(state.available&&!state.request));a.disabled=busy||!eligible();
    $('#availability-help').textContent=state.request?'No recibirás otra solicitud mientras atiendes esta.':!state.shift?'Primero inicia tu jornada.':!state.network?'Necesitas conexión con la central.':state.location!=='granted'?'Activa el permiso de ubicación.':!validLocation()?'Actualiza tu ubicación para continuar.':state.available?'Recibirás solicitudes cercanas.':'Activa este control cuando puedas recibir servicios.';
    let next='';
    if(state.request)next=actionLink(state.request.status==='active'?'Ver servicio actual':'Responder solicitud',state.request.status==='active'?'en-servicio':'solicitud-entrante');
    else if(!state.network)next=note('Sin conexión. Revisa tu red antes de ponerte disponible.');
    else if(state.shift&&state.location!=='granted')next=note('<b>Un paso más para recibir servicios.</b><a class="link" href="ubicacion.html">Configurar mi ubicación →</a>','');
    else if(state.shift&&!validLocation())next=note('<b>Ubicación desactualizada.</b><a class="link" href="ubicacion-desactualizada.html">Actualizar ubicación →</a>','');
    $('#home-next').innerHTML=next;$('#home-next').hidden=!next;
    $('#home-location-title').textContent=state.location==='granted'?(validLocation()?'Ubicación lista':'Ubicación sin actualizar'):'Configura tu ubicación';
    $('#home-location-sub').textContent=state.location==='granted'?(state.shift&&validLocation()?'Compartiendo durante tu jornada.':state.shift?'No disponible para nuevas solicitudes.':'Se compartirá al iniciar tu jornada.'):'Necesaria para ponerte disponible.';
  }
  function renderLocation(){
    if(!$('#location-title'))return;
    const granted=state.location==='granted',valid=validLocation();
    $('#location-title').textContent=granted?'Tu ubicación está habilitada.':state.location==='denied'?'Necesitamos tu permiso.':'Comparte tu ubicación.';
    $('#location-description').textContent=granted?'Podrás recibir solicitudes cercanas cuando tu jornada y disponibilidad estén activas.':'La central la necesita para conectarte con solicitudes cercanas.';
    $('#location-button').textContent=granted?'Actualizar ubicación':state.location==='denied'?'Revisar permiso de ubicación':'Permitir ubicación';
    $('#location-button').dataset.action=granted?'refresh-location':'location-permission';
    $('#location-status').innerHTML=granted?note(state.shift?(valid?'Ubicación actualizada. Mantén abierta la app durante tu jornada.':'Ubicación sin actualizar. Revisa tu conexión y vuelve a intentar.'):'Permiso concedido. La ubicación se compartirá al iniciar tu jornada.',valid?'green':'blue'):state.location==='denied'?note('Permiso no concedido. Puedes iniciar jornada, pero no recibirás solicitudes.',''):' ';
  }
  function renderService(){
    if(!$('#accepted-time'))return;
    $('#accepted-time').textContent=new Date(state.request.acceptedAt).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'});
    if(state.closeAfter){$('#service-shift-message').innerHTML=note('<b>Cierre de jornada solicitado.</b> Completa este servicio; luego se cerrará tu jornada.','');$('#end-after-button').hidden=true;}
  }
  function renderProfile(){
    const el=$('#profile-state');if(!el)return;
    const label={aprobado:'Cuenta aprobada',pendiente:'Cuenta en revisión',rechazado:'Registro no aprobado',suspendido:'Cuenta suspendida'};
    el.textContent=label[state.account];el.className='badge '+({aprobado:'green',pendiente:'yellow',rechazado:'red',suspendido:'red'}[state.account]);
    if(state.account!=='aprobado'){
      const nav=$('.bottomnav');if(nav)nav.innerHTML=`<a href="${accountRoute()}.html">Ver estado de mi cuenta</a>`;
      const back=$('.app-header a');if(back)back.href=accountRoute()+'.html';
    }
  }
  function renderFinished(){const el=$('#finished-next');if(el)el.innerHTML=note(state.shift?(state.available?'Tu jornada sigue activa. Estás disponible para un nuevo servicio.':'Tu jornada sigue activa. Revisa tu disponibilidad antes de continuar.'):'Tu jornada ha finalizado. Gracias por completar tu servicio.','green');}
  function renderCatalog(){const el=$('#demo-summary');if(el)el.textContent=`Estado actual: ${state.account} · ${state.shift?'jornada activa':'jornada sin iniciar'} · ${state.request?(state.request.status==='active'?'en servicio':'solicitud pendiente'):state.available?'disponible':'no disponible'}.`;}
  function render(){renderBindings();renderHome();renderLocation();renderService();renderProfile();renderFinished();renderCatalog();}
  render();
  if(!storageAvailable)toast('El navegador bloqueó el almacenamiento local. Abre el paquete en Chrome o Edge para conservar el recorrido.');
  function networkGuard(selector){if(state.network)return true;notifyInline(selector,'Sin conexión. No se confirmó la operación. Revisa tu conexión con la central.');return false;}
  async function simulate(action,button,selector){
    if(busy)return;
    if(!networkGuard(selector))return;
    busy=true;const old=button?.textContent;if(button){button.disabled=true;button.textContent='Confirmando…';button.setAttribute('aria-busy','true');}
    await new Promise(r=>setTimeout(r,500));
    if(state.network)action();else networkGuard(selector);
    busy=false;if(button?.isConnected){button.disabled=false;button.textContent=old;button.removeAttribute('aria-busy');}
  }
  function setLocation(){state.location='granted';state.manualStale=false;state.locationAt=Date.now();save();render();}
  function closeShift(){state.shift=false;state.available=false;state.closeAfter=false;save();render();toast('Jornada finalizada. No recibirás nuevas solicitudes.');}
  function askCloseAfter(){
    if(state.closeAfter)return toast('Tu jornada se cerrará al finalizar este servicio.');
    if(!networkGuard())return;
    openDialog('¿Terminar después de este servicio?','Completa el recorrido actual. Después, tu jornada se cerrará y no recibirás nuevas solicitudes.','Terminar jornada después',()=>{if(!networkGuard())return;state.closeAfter=true;state.available=false;save();render();toast('Cierre de jornada solicitado. Completa tu servicio actual.');});
  }
  function demoAvailable(){state=base();state.auth=true;state.shift=true;state.location='granted';state.locationAt=Date.now();state.available=true;save();}
  const actions={
    'resume':()=>go(currentRoute()),
    'toggle-shift':()=>{
      if(!allowed()||!networkGuard())return;
      if(state.request?.status==='pending')return toast('Responde primero la solicitud pendiente.');
      if(state.request?.status==='active')return askCloseAfter();
      if(state.shift)return openDialog('¿Finalizar tu jornada?','Dejarás de recibir nuevas solicitudes. Podrás iniciar otra jornada cuando vuelvas a trabajar.','Finalizar jornada',()=>{if(networkGuard())closeShift();});
      state.shift=true;state.closeAfter=false;if(state.location==='granted'&&!state.manualStale)state.locationAt=Date.now();save();render();toast('Jornada iniciada. Activa tu disponibilidad cuando estés listo.');
    },
    'toggle-available':()=>{if(!eligible())return;state.available=!state.available;save();render();toast(state.available?'Estás disponible para recibir solicitudes.':'No recibirás nuevas solicitudes. Tu jornada sigue activa.');},
    'location-permission':()=>openDialog('Ubicación durante tu jornada','Simulación del permiso de dispositivo. Este prototipo no obtiene tu GPS real. En la app, TaxiSur solicitará permiso para usar la ubicación mientras está abierta.','Permitir en la demo',()=>{setLocation();toast('Permiso de ubicación concedido en la demostración.');},'No permitir',()=>{state.location='denied';state.available=false;save();render();toast('Sin permiso no puedes ponerte disponible.');}),
    'refresh-location':(button)=>{
      if(state.location!=='granted')return actions['location-permission']();
      simulate(()=>{setLocation();if(page==='ubicacion-desactualizada')go('inicio');else toast('Ubicación actualizada en la demostración.');},button);
    },
    'check-account':async(button)=>{
      if(!state.network)return toast('Sin conexión. No pudimos consultar el estado.');
      await simulate(()=>{
        try{const stored=JSON.parse(localStorage.getItem(KEY));if(stored?.version===1)state=stored;}catch(_){}
        if(state.account==='aprobado'){go('inicio');return;}
        if(page!==accountRoute()){go(accountRoute());return;}
        notifyInline('#review-message',state.account==='pendiente'?'Tu cuenta sigue en revisión. La administración aún no la ha aprobado.':'El estado de tu cuenta no ha cambiado. Comunícate con la administración.');
      },button);
    },
    'accept-request':(button)=>{
      if(!state.request||state.request.status!=='pending'||expire())return;
      simulate(()=>{
        if(expire()||!state.request)return;
        if(!allowed())return go(accountRoute());
        state.request.status='active';state.request.acceptedAt=Date.now();state.available=false;save();go('en-servicio');
      },button,'#request-error');
    },
    'reject-request':(button)=>{
      if(!state.request||state.request.status!=='pending'||expire())return;
      simulate(()=>{if(expire()||!state.request)return;state.lastRequest={...state.request,status:'rejected'};state.request=null;state.available=eligible();save();go('inicio');},button,'#request-error');
    },
    'end-after-service':()=>askCloseAfter(),
    'finish-service':()=>{
      if(state.request?.status!=='active'||busy||!networkGuard('#service-error'))return;
      openDialog('¿Finalizar este servicio?','Confirma solo cuando hayas completado el recorrido con la pasajera.','Sí, finalizar servicio',()=>simulate(()=>{
        if(state.request?.status!=='active')return;
        state.lastRequest={...state.request,status:'finished',finishedAt:Date.now()};state.request=null;
        if(state.closeAfter){state.shift=false;state.closeAfter=false;state.available=false;}else state.available=eligible();
        save();go('servicio-finalizado');
      },$('[data-action="finish-service"]'),'#service-error'));
    },
    'logout':()=>{
      if(state.request)return toast('Resuelve la solicitud o finaliza el servicio antes de cerrar sesión.');
      openDialog('¿Cerrar sesión?','Si tu jornada está activa, se finalizará para dejar de recibir solicitudes.','Cerrar sesión',()=>{if(state.shift&&!networkGuard())return;state.auth=false;state.shift=false;state.available=false;state.closeAfter=false;save();go('login');});
    },
    'retry-connection':async(button)=>{
      if(busy)return;busy=true;button.disabled=true;button.textContent='Reconectando…';button.setAttribute('aria-busy','true');
      await new Promise(r=>setTimeout(r,800));
      state.network=true;if(state.shift&&state.location==='granted'&&!state.manualStale)state.locationAt=Date.now();save();expire();go(currentRoute());
    },
    'return-current':()=>go(currentRoute()),
    'demo-available':()=>{demoAvailable();go('inicio');},
    'demo-request':()=>{
      if(state.request)return go(state.request.status==='active'?'en-servicio':'solicitud-entrante');
      if(!state.auth||state.account!=='aprobado')return toast('Abre primero una escena de conductor aprobado o aprueba el registro de prueba desde el índice.');
      if(!eligible()||!state.available)return toast('Inicia jornada, concede ubicación y activa disponibilidad. También puedes usar “Ver conductor disponible” en el índice.');
      state.request=makeRequest();state.available=false;save();go('solicitud-entrante');
    },
    'demo-no-destination':()=>{if(state.request)return toast('Termina la solicitud o el servicio actual antes de simular otro.');demoAvailable();state.request=makeRequest();state.request.destination=null;state.available=false;save();go('solicitud-entrante');},
    'demo-approve':()=>{
      if(state.account!=='pendiente')return toast('No hay un registro pendiente. Abre “Cuenta en revisión” o completa el registro.');
      state.account='aprobado';state.auth=true;save();renderCatalog();toast('Aprobación del administrador simulada. Usa “Continuar mi demo”.');
    },
    'demo-stale':()=>{
      if(!allowed())return toast('Abre primero una escena con cuenta aprobada.');
      state.shift=true;state.location='granted';state.locationAt=Date.now()-360000;state.manualStale=true;state.available=false;save();go('ubicacion-desactualizada');
    },
    'demo-offline':()=>{if(!allowed())return toast('Abre primero una escena con cuenta aprobada.');state.network=false;state.available=false;save();go('sin-conexion');},
    'demo-online':()=>{state.network=true;save();render();toast('Conexión restablecida en la demo. Usa “Continuar mi demo”.');},
    'demo-reset':()=>openDialog('¿Reiniciar la demostración?','Se borrarán únicamente los datos ficticios de este prototipo de conductores.','Reiniciar demo',()=>{state=base();save();go('ABRIR_AQUI');}),
    'register-next':()=>registerNext(),
    'register-back':()=>registerStep(false),
    'component-toast':()=>toast('Ejemplo de confirmación. Acción completada.'),
    'component-switch':(button)=>button.setAttribute('aria-checked',String(button.getAttribute('aria-checked')!=='true')),
    'component-modal':()=>openDialog('¿Confirmar esta acción?','Ejemplo del patrón de confirmación para acciones relevantes.','Confirmar',()=>toast('Acción confirmada.')),
    'component-loading':async(button)=>{if(busy)return;busy=true;button.disabled=true;button.textContent='Consultando estado…';button.setAttribute('aria-busy','true');await new Promise(r=>setTimeout(r,1200));button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Ver estado de carga';busy=false;toast('Estado actualizado.');}
  };
  document.addEventListener('click',e=>{
    const toggle=e.target.closest('[data-show-pin]');
    if(toggle){const input=document.getElementById(toggle.dataset.showPin);const show=input.type==='password';input.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',(show?'Ocultar':'Mostrar')+' PIN');return;}
    const button=e.target.closest('[data-action]');if(button&&!button.disabled){const fn=actions[button.dataset.action];if(fn)fn(button);}
  });
  function normalizePhone(x){return x.replace(/[\s()-]/g,'').replace(/^\+591/,'');}
  function validPhone(x){return /^[67]\d{7}$/.test(normalizePhone(x));}
  $('#login-form')?.addEventListener('submit',async(e)=>{
    e.preventDefault();if(busy)return;
    const tel=normalizePhone($('#telefono').value),pin=$('#pin').value;
    const error=$('#login-error');error.textContent='';
    if(tel!=='70000000'||pin!=='1234'){
      error.textContent='Teléfono o PIN incorrecto';$('#telefono').setAttribute('aria-invalid','true');$('#pin').setAttribute('aria-invalid','true');$('#telefono').focus();return;
    }
    $('#telefono').removeAttribute('aria-invalid');$('#pin').removeAttribute('aria-invalid');
    await simulate(()=>{state=base();state.auth=true;save();go('inicio');},e.submitter,'#login-error');
  });
  function validationError(text,field){$('#register-error').textContent=text;if(field){field.setAttribute('aria-invalid','true');field.focus();}}
  function registerStep(second){$('#personal-step').hidden=second;$('#vehicle-step').hidden=!second;$('#step-two-bar').classList.toggle('on',second);$('#step-label').textContent=second?'PASO 2 DE 2 · TU VEHÍCULO':'PASO 1 DE 2 · TUS DATOS';$('#register-error').textContent='';$('#main').scrollTop=0;(second?$('#placa'):$('#nombre')).focus();}
  function validatePersonal(){
    const required=['nombre','ci','registro-telefono','registro-pin','confirmar-pin'];
    for(const id of required){const el=$('#'+id);el.removeAttribute('aria-invalid');if(!el.value.trim()){validationError('Completa todos tus datos para continuar.',el);return false;}}
    if($('#nombre').value.trim().length<3){validationError('Escribe tu nombre completo.',$('#nombre'));return false;}
    if(!validPhone($('#registro-telefono').value)){validationError('Escribe un teléfono boliviano de 8 dígitos que empiece con 6 o 7.',$('#registro-telefono'));return false;}
    if(!/^\d{4,6}$/.test($('#registro-pin').value)){validationError('Tu PIN debe tener entre 4 y 6 dígitos.',$('#registro-pin'));return false;}
    if($('#registro-pin').value!==$('#confirmar-pin').value){validationError('Los PIN no coinciden. Vuelve a confirmarlo.',$('#confirmar-pin'));return false;}
    if(normalizePhone($('#registro-telefono').value)===fixture.phone){validationError('Este teléfono ya tiene una cuenta de demostración. Usa otro para probar el registro.',$('#registro-telefono'));return false;}
    return true;
  }
  function registerNext(){if(validatePersonal())registerStep(true);}
  $('#register-form')?.addEventListener('submit',async(e)=>{
    e.preventDefault();if(busy)return;
    if(!$('#personal-step').hidden){registerNext();return;}
    if(!validatePersonal()){registerStep(false);validatePersonal();return;}
    for(const id of ['placa','marca','modelo','color','capacidad']){const el=$('#'+id);el.removeAttribute('aria-invalid');if(!el.value.trim()){validationError('Completa todos los datos de tu vehículo.',el);return;}}
    if($('#placa').value.toUpperCase().replace(/[-\s]/g,'')===fixture.plate.replace(/\s/g,'')){validationError('Esta placa ya existe en la demostración. Prueba con otra.',$('#placa'));return;}
    await simulate(()=>{
      const p={name:$('#nombre').value.trim(),ci:$('#ci').value.trim(),phone:normalizePhone($('#registro-telefono').value),plate:$('#placa').value.trim().toUpperCase(),brand:$('#marca').value.trim(),model:$('#modelo').value.trim(),color:$('#color').value.trim(),capacity:Number($('#capacidad').value)};
      state=base();state.profile=p;state.auth=true;state.account='pendiente';save();$('#registro-pin').value='';$('#confirmar-pin').value='';go('cuenta-en-revision');
    },e.submitter,'#register-error');
  });
  function tick(){
    expire();
    if(page==='solicitud-entrante'&&state.request?.status==='pending'){
      const n=Math.max(0,Math.ceil((state.request.deadline-Date.now())/1000));
      $('#seconds').textContent=n;$('#timer').setAttribute('aria-label',`${n} segundos restantes`);$('#timer').classList.toggle('urgent',n<=10);
      $('#timer .progress').style.strokeDashoffset=String(264*(1-n/60));
      if(n<=10&&!timerWarning){timerWarning=true;toast('Quedan 10 segundos o menos para responder.');}
    }
    if(state.available&&(!validLocation()||!state.network)){state.available=false;save();renderHome();}
  }
  tick();setInterval(tick,1000);
  setInterval(()=>{
    if(state.shift&&state.location==='granted'&&state.network&&!state.manualStale&&document.visibilityState==='visible'){
      state.locationAt=Date.now();save();renderLocation();renderHome();
    }
  },45000);
  window.addEventListener('storage',e=>{
    if(e.key!==KEY)return;
    try {const next=JSON.parse(e.newValue);if(next?.version!==1)return;state=next;
      if(!publicPages.includes(page)&&!state.auth)return go('login');
      if(!publicPages.includes(page)&&state.account!=='aprobado'&&page!==accountRoute()&&page!=='perfil')return go(accountRoute());
      if(['cuenta-en-revision','cuenta-rechazada','cuenta-suspendida'].includes(page)&&state.account==='aprobado')return go('inicio');
      if(page==='en-servicio'&&state.request?.status!=='active')return go(currentRoute());
      if(page==='solicitud-entrante'&&state.request?.status!=='pending')return go(currentRoute());
      render();tick();
    }catch(_){}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){tick();render();}});
})();
