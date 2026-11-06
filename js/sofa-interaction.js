AFRAME.registerComponent('sit-on-click', {

  schema: {
    maxDistance: {default: 2.5}, // Distância máxima para sentar-se no sofá 
    hoverScale: {default: 1.05}, // Escala do sofá quando o cursor está sobre ele
    seatOffset: {type: 'vec3', default: {x: 0, y: 525, z: 30}} // Posição da rig do jogador em relação ao sofá quando sentado
  },

  init: function () {
    this.rig = this.el.sceneEl.querySelector('#player-rig');
    this.pointers = new Set(); 
    this.saved = null; // Posição e rotação salvas da rig do jogador antes de sentar-se
    this.mesh = null; // Mesh do sofá
    this.factor = 1; // Fator de escala do sofá (1 = normal, >1 = ampliado)
    this.focused = false; // Indica se o cursor está sobre o sofá
    this.head = new THREE.Vector3(); // Posição da cabeça do jogador

    // Função para atualizar a mesh do sofá quando o modelo é carregado
    this.onModel = () => {
      this.mesh = this.el.getObject3D('mesh');
      this.baseScale = this.mesh.scale.clone();
    };

    this.onEnter = event => this.pointers.add(event.detail.cursorEl || event.target); // Adiciona o cursor à lista de ponteiros quando aponta para o sofá
    this.onLeave = event => this.pointers.delete(event.detail.cursorEl || event.target);  // Remove o cursor da lista de ponteiros quando deixa de apontar para o sofá
    this.onClick = event => this.sit(event.detail.cursorEl); // Sentar-se no sofá quando o jogador clica nele
    this.onStand = () => { this.stand(); this.pointers.clear(); }; // Levanta-se do sofá e limpa a lista de ponteiros

    this.onKey = event => {
      if (event.code === 'KeyE' && !event.repeat) this.stand(); // Levanta-se do sofá quando o jogador pressiona a tecla "E"
    }; 

    this.onDisconnect = event => this.pointers.delete(event.target); // Remove o cursor da lista de ponteiros quando o controlador é desconectado
    this.el.addEventListener('model-loaded', this.onModel); // Atualiza a mesh do sofá quando o modelo é carregado

    // Faz o mesmo mas para o desktop
    this.el.addEventListener('mouseenter', this.onEnter); 
    this.el.addEventListener('mouseleave', this.onLeave); 
    this.el.addEventListener('click', this.onClick); 
    window.addEventListener('keydown', this.onKey);

    this.el.sceneEl.addEventListener('leave-seat', this.onStand); // Levanta-se do sofá quando o jogador sai do assento
    this.controllers = Array.from(this.rig.querySelectorAll('[laser-controls]'));  
    
    for (const controller of this.controllers) {
      controller.addEventListener('gripdown', this.onStand);
      controller.addEventListener('controllerdisconnected', this.onDisconnect);
    }
    if (this.el.getObject3D('mesh')) this.onModel();
  },

  // Verifica se o jogador está próximo o suficiente do sofá para sentar-se
  isNear: function () {
    const player = this.rig.components['player-controls'];
    const box = this.el.components['furniture-collider'].box;
    if (!player || !box) return false;
    player.getHeadPosition(this.head);
    const x = THREE.MathUtils.clamp(this.head.x, box.min.x, box.max.x);
    const z = THREE.MathUtils.clamp(this.head.z, box.min.z, box.max.z);
    return Math.hypot(this.head.x - x, this.head.z - z) <= this.data.maxDistance;
  },

  // Atualiza a escala do sofá e o cursor do mouse a cada frame
  tick: function (time, delta) {
    if (!this.mesh) return;
    const near = !this.saved && this.isNear();
    this.focused = near && this.pointers.size > 0;
    const target = this.focused ? this.data.hoverScale : 1;
    this.factor = THREE.MathUtils.lerp(this.factor, target, 1 - Math.exp(-12 * (delta || 0) / 1000));
    // Só o mesh visual aumenta, o collider e o assento mantêm as dimensões
    this.mesh.scale.copy(this.baseScale).multiplyScalar(this.factor);
    const canvas = this.el.sceneEl.canvas;
    if (canvas) canvas.style.cursor = this.focused ? 'pointer' : '';
  },

  // Faz o jogador sentar-se no sofá, salvando a posição e rotação atuais da rig do jogador
  sit: function (controller) {
  
    if (this.saved || !this.mesh || !this.isNear()) return; // Se o jogador já estiver sentado, se a mesh do sofá não estiver carregada ou se o jogador não estiver próximo o suficiente, não faz nada
    const player = this.rig.components['player-controls']; // Obtém o componente de controle do jogador
    this.mesh.scale.copy(this.baseScale); // Restaura a escala original do sofá antes de sentar-se
    this.factor = 1; // Restaura o fator de escala do sofá para 1 (normal)
    
    // Salva a posição e rotação atuais da rig do jogador antes de sentar-se
    this.saved = {
      position: this.rig.object3D.position.clone(),
      rotation: this.rig.object3D.rotation.clone()
    };

    // Calcula a posição do assento do sofá em relação à rig do jogador e move a rig para essa posição, apontando para a tela da TV
    const offset = this.data.seatOffset;
    this.el.object3D.updateWorldMatrix(true, false);
    const seat = this.el.object3D.localToWorld(new THREE.Vector3(offset.x, offset.y, offset.z));
    const screen = this.el.sceneEl.querySelector('#tv-screen');
    const target = screen.object3D.getWorldPosition(new THREE.Vector3());
    player.seated = true;
    player.placeHead(seat, target);
    this.pointers.clear();

    // Oculta a mensagem na tv e mostra o menu da TV quando o jogador se senta no sofá
    this.el.sceneEl.querySelector('#tv-message')?.setAttribute('visible', false);
    this.el.sceneEl.querySelector('#tv-menu')?.setAttribute('visible', true);
  },


  // Faz o jogador levantar-se do sofá, restaurando a posição e rotação salvas da rig do jogador
  stand: function () {
    if (!this.saved) return;
    const player = this.rig.components['player-controls'];  // Obtém o componente de controle do jogador

    // Restaura a posição da rig do jogador para a posição salva antes de sentar-se
    this.rig.object3D.position.copy(this.saved.position); 
    this.rig.object3D.rotation.copy(this.saved.rotation); 
    player.seated = false;
    player.previous = null;
    player.clearInput();
    this.saved = null;
    this.pointers.clear();

    // Mostra a mensagem na tv e fecha o menu da TV quando o jogador se levanta do sofá
    this.el.sceneEl.querySelector('#tv-message')?.setAttribute('visible', true);
    this.el.sceneEl.querySelector('#tv-menu')?.components['tv-menu']?.close();
  },

  // Remove os event listeners e limpa a lista de ponteiros quando o componente é removido
  remove: function () {
    this.stand();
    if (this.mesh) this.mesh.scale.copy(this.baseScale);
    if (this.el.sceneEl.canvas) this.el.sceneEl.canvas.style.cursor = '';

    this.el.removeEventListener('model-loaded', this.onModel);
    this.el.removeEventListener('mouseenter', this.onEnter);
    this.el.removeEventListener('mouseleave', this.onLeave);
    this.el.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKey);
    this.el.sceneEl.removeEventListener('leave-seat', this.onStand);

    for (const controller of this.controllers) {
      controller.removeEventListener('gripdown', this.onStand);
      controller.removeEventListener('controllerdisconnected', this.onDisconnect);
    }
  }
});
