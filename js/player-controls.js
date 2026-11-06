// Componente de movimento do jogador, incluindo colisão com móveis e limites da sala
AFRAME.registerComponent('player-controls', {
  // Limites da sala, em unidades da cena
  schema: {
    minX: {default: 0}, maxX: {default: 17}, minZ: {default: -23.8}, maxZ: {default: 0}, // Limites da sala
    radius: {default: 0.4}, // Raio do jogador para colisão com móveis.
    stepHeight: {default: 0.15}, // Altura máxima de altura que o jogador pode subir (para o tapete)
    eyeHeight: {default: 5.6}, speed: {default: 8},
    vrScale: {default: 3.3} // Os móveis existentes têm aproximadamente 3,3 vezes a escala real
  },

  init: function () { 
    this.camera = this.el.querySelector('#player-camera'); // Procura a câmera dentro do rig do jogador
    this.keys = new Set(); // Conjunto de teclas atualmente pressionadas
    this.seated = false; // Se o jogador está sentado virtualmente (bloqueia o movimento)
    this.inVR = false; // Se o jogador está em modo VR

    //Vetores de coordenadas para cálculos de movimento e colisão
    this.head = new THREE.Vector3(); 
    this.forward = new THREE.Vector3(); 
    this.right = new THREE.Vector3(); 
    this.previous = null; // Posição anterior da cabeça para detectar colisões
    
    // Eventos de teclado para o movimento no desktop
    this.onKeyDown = event => {
      if (!event.target.closest(
        'input, textarea, button, [contenteditable]'
      )) {
        this.keys.add(event.code);
      }
    };

    this.onKeyUp = event => this.keys.delete(event.code); // Remove a tecla do conjunto quando solta
    this.clearInput = () => this.keys.clear(); // Limpa as teclas de movimento

    // Adiciona os ouvintes de eventos para teclado e perda de foco da janela
    window.addEventListener('keydown', this.onKeyDown); 
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInput); // Se a janela perder o foco evita que o jogader fique preso com uma tecla pressionada


  },

  // Obtém a posição da cabeça do jogador no mundo, para cálculos de colisão e movimento
  getHeadPosition: function (target) {
    this.camera.object3D.updateWorldMatrix(true, false);
    return this.camera.object3D.getWorldPosition(target);
  },

  // Obtém a direção para a frente da câmera do jogador, para determinar a direção do movimento
  getForward: function (target) {
    const camera = this.camera.getObject3D('camera');
    camera.updateWorldMatrix(true, false);
    return camera.getWorldDirection(target);
  },

  // Gira o rig do jogador em torno da posição da cabeça para alinhar a vista com os objetos
  rotateAroundHead: function (angle) {
    const before = this.getHeadPosition(new THREE.Vector3());
    this.el.object3D.rotation.y += angle;
    const after = this.getHeadPosition(new THREE.Vector3());
    this.el.object3D.position.add(before.sub(after));
  },

  // Quando o jogador senta no sofá, reposiciona o rig do jogador para que a cabeça fique na posição correta
  placeHead: function (position, target) {
    const direction = target.clone().sub(position);
    const forward = this.getForward(new THREE.Vector3());
    const desiredYaw = Math.atan2(-direction.x, -direction.z);
    const currentYaw = Math.atan2(-forward.x, -forward.z);
    this.rotateAroundHead(desiredYaw - currentYaw);
    const head = this.getHeadPosition(new THREE.Vector3());
    this.el.object3D.position.add(position.clone().sub(head));
    this.previous = null;
    this.clearInput();
  },

  // Função para mudar o estado do jogador entre VR e desktop, ajustando a escala, posição e controles de acordo com o modo
  syncMode: function () {
    // O botão do A-Frame também ativa "vr-mode" no fullscreen sem headset.

    const xr = this.el.sceneEl.renderer.xr; // Acesso ao sistema de XR do Three.js para verificar se o headset está presente
    const inVR = this.el.sceneEl.is('vr-mode') && xr.isPresenting === true; // Verifica se o jogador está em modo VR e se o headset está ativo
    if (inVR === this.inVR) return; // Se o estado não mudou, não faz nada.
    
    this.el.sceneEl.emit('leave-seat', {}, false); // Sai do assento virtual se o jogador estiver sentado ao mudar de modo
    this.clearInput(); // Limpa as teclas de movimento ao mudar de modo.

    // Ajusta a escala, rotação e controles do jogador dependendo se está em VR ou desktop
    if (inVR) {
      this.desktopRotation = this.el.object3D.rotation.clone();
      this.el.object3D.scale.setScalar(this.data.vrScale);
      // A orientação inicial de 90 graus faz o utilizador olhar para a TV
      this.el.object3D.rotation.set(0, Math.PI / 2, 0);
      this.camera.components.cursor.pause();
      this.camera.setAttribute('raycaster', 'enabled', false);
    } else {
      this.el.object3D.scale.setScalar(1);
      this.el.object3D.rotation.copy(this.desktopRotation);
      this.camera.setAttribute('position', {x: 0, y: this.data.eyeHeight, z: 0});
      this.camera.components.cursor.play();
      this.camera.setAttribute('raycaster', 'enabled', true);
    }
    // Ajusta a posição vertical do rig do jogador para que a cabeça fique na altura correta
    this.el.object3D.position.y = 0;
    this.inVR = inVR;
    this.previous = null;
  },

  // Função chamada a cada frame para atualizar a posição do jogador, aplicar colisões e ajustar a altura da câmera
  tick: function (time, delta) {
    if (!this.camera.getObject3D('camera')) return;
    this.syncMode();
    if (this.seated) return; // Se o jogador estiver sentado, não permite movimento
    
    // Movimento do jogador no modo desktop, baseado nas teclas pressionadas 
    if (!this.inVR) { 
      this.camera.object3D.position.y = this.data.eyeHeight;
      this.getForward(this.forward);
      this.forward.y = 0;
      this.forward.normalize();
      this.right.set(-this.forward.z, 0, this.forward.x);
      const x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const z = Number(this.keys.has('KeyW') ) - Number(this.keys.has('KeyS'));
      const length = Math.max(1, Math.hypot(x, z));
      const distance = this.data.speed * Math.min(delta || 0, 50) / 1000;
      this.el.object3D.position.addScaledVector(this.forward, z / length * distance);
      this.el.object3D.position.addScaledVector(this.right, x / length * distance);
    }
    // Aplica colisões com móveis e limites da sala, ajustando a posição do jogador conforme necessário
    this.resolveCollisions();
  },

  // Função para resolver colisões do jogador com móveis e limites da sala
  resolveCollisions: function () {
    const data = this.data; //
    this.getHeadPosition(this.head);
    if (!this.previous) this.previous = this.head.clone(); // Inicializa a posição anterior da cabeça se ainda não estiver definida
    const desired = this.head.clone(); // Posição desejada da cabeça do jogador antes de aplicar colisões
    const dx = desired.x - this.previous.x; // Calcula a diferença de posição desejada em x e z para determinar o movimento do jogador
    const dz = desired.z - this.previous.z; 
  
    // Obtém todos os objetos com o componente "furniture-collider" na cena, filtrando apenas aqueles que estão dentro da altura do jogador e que podem ser colididos
    const boxes = Array.from(this.el.sceneEl.querySelectorAll('[furniture-collider]'),
      el => el.components['furniture-collider'].box
    ).filter(box => box && box.max.y > data.stepHeight && box.min.y < this.head.y + 0.3);

    // Determina o número de passos para dividir o movimento desejado em incrementos menores, garantindo que a colisão seja verificada em cada passo
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (data.radius / 2))); 
    this.head.copy(this.previous); 

    // Para cada passo do movimento desejado, verifica se há colisões com os móveis e ajusta a posição da cabeça do jogador conforme necessário
    for (let step = 0; step < steps; step++) {
      for (const axis of ['x', 'z']) {
        const delta = (axis === 'x' ? dx : dz) / steps;
        this.head[axis] += delta;
        for (const box of boxes) {
          if (this.head.x > box.min.x - data.radius && this.head.x < box.max.x + data.radius &&
              this.head.z > box.min.z - data.radius && this.head.z < box.max.z + data.radius) {
            const min = box.min[axis] - data.radius;
            const max = box.max[axis] + data.radius;
            this.head[axis] = delta > 0 ? min : delta < 0 ? max :
              (this.head[axis] - min < max - this.head[axis] ? min : max);
          }
        }
        this.head[axis] = THREE.MathUtils.clamp(this.head[axis],
          (axis === 'x' ? data.minX : data.minZ) + data.radius,
          (axis === 'x' ? data.maxX : data.maxZ) - data.radius);
      }
    }
    // Atualiza a posição do rig do jogador com base na posição final da cabeça após aplicar colisões
    this.el.object3D.position.x += this.head.x - desired.x;
    this.el.object3D.position.z += this.head.z - desired.z;
    this.previous.copy(this.head);
  },

  // Remove os ouvintes de eventos quando o componente é removido, evitando vazamentos de memória
  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInput);
  }
});
