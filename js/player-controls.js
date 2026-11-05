/* global AFRAME, THREE */
// Move o rig, nunca a pose da cabeça: o tracking WebXR continua livre.
AFRAME.registerComponent('player-controls', {
  schema: {
    minX: {default: 0}, maxX: {default: 17},
    minZ: {default: -23.8}, maxZ: {default: 0},
    radius: {default: 0.4}, stepHeight: {default: 0.15},
    eyeHeight: {default: 5.6}, speed: {default: 8},
    // Os móveis existentes têm aproximadamente 3,3 vezes a escala real.
    vrScale: {default: 3.3}
  },

  init: function () {
    this.camera = this.el.querySelector('#player-camera');
    this.keys = new Set();
    this.stick = {x: 0, y: 0};
    this.seated = false;
    this.inVR = false;
    this.turnReady = true;
    this.head = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.previous = null;
    this.onKeyDown = event => {
      if (!event.target.closest?.('input, textarea, button, [contenteditable]')) this.keys.add(event.code);
    };
    this.onKeyUp = event => this.keys.delete(event.code);
    this.clearInput = () => { this.keys.clear(); this.stick.x = this.stick.y = 0; };
    this.onStick = event => { this.stick.x = event.detail.x; this.stick.y = event.detail.y; };
    this.onDisconnect = () => { this.stick.x = this.stick.y = 0; this.turnReady = true; };
    this.onTurn = event => {
      if (Math.abs(event.detail.x) < 0.3) this.turnReady = true;
      if (!this.inVR || !this.turnReady || Math.abs(event.detail.x) < 0.7) return;
      this.rotateAroundHead(-Math.sign(event.detail.x) * Math.PI / 6);
      this.turnReady = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInput);
    this.left = this.el.querySelector('#left-controller');
    this.rightController = this.el.querySelector('#right-controller');
    this.left.addEventListener('thumbstickmoved', this.onStick);
    this.rightController.addEventListener('thumbstickmoved', this.onTurn);
    this.left.addEventListener('controllerdisconnected', this.onDisconnect);
    this.rightController.addEventListener('controllerdisconnected', this.onDisconnect);
  },

  getHeadPosition: function (target) {
    this.camera.object3D.updateWorldMatrix(true, false);
    return this.camera.object3D.getWorldPosition(target);
  },

  getForward: function (target) {
    const camera = this.camera.getObject3D('camera');
    camera.updateWorldMatrix(true, false);
    return camera.getWorldDirection(target);
  },

  rotateAroundHead: function (angle) {
    const before = this.getHeadPosition(new THREE.Vector3());
    this.el.object3D.rotation.y += angle;
    const after = this.getHeadPosition(new THREE.Vector3());
    this.el.object3D.position.add(before.sub(after));
  },

  // Alinhar a vista com a TV sem alterar a rotação física do headset.
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

  syncMode: function () {
    // O botão do A-Frame também ativa "vr-mode" no fullscreen sem headset.
    // A escala e os comandos VR só devem mudar numa sessão XR imersiva real.
    const xr = this.el.sceneEl.renderer.xr;
    const inVR = this.el.sceneEl.is('vr-mode') && xr.isPresenting === true;
    if (inVR === this.inVR) return;
    // Levantar antes de mudar de modo evita manter um offset de assento em VR.
    this.el.sceneEl.emit('leave-seat', {}, false);
    this.clearInput();
    if (inVR) {
      this.desktopRotation = this.el.object3D.rotation.clone();
      this.el.object3D.scale.setScalar(this.data.vrScale);
      // A orientação inicial de 90 graus faz o utilizador olhar para a TV.
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
    this.el.object3D.position.y = 0;
    this.inVR = inVR;
    this.previous = null;
  },

  tick: function (time, delta) {
    if (!this.camera.getObject3D('camera')) return;
    this.syncMode();
    if (this.seated) return;
    if (!this.inVR) this.camera.object3D.position.y = this.data.eyeHeight;
    this.getForward(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
    let x = 0;
    let z = 0;
    if (this.inVR) {
      x = Math.abs(this.stick.x) > 0.15 ? this.stick.x : 0;
      z = Math.abs(this.stick.y) > 0.15 ? -this.stick.y : 0;
    } else {
      x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
      z = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    }
    const length = Math.max(1, Math.hypot(x, z));
    const distance = this.data.speed * Math.min(delta || 0, 50) / 1000;
    this.el.object3D.position.addScaledVector(this.forward, z / length * distance);
    this.el.object3D.position.addScaledVector(this.right, x / length * distance);
    this.resolveCollisions();
  },

  resolveCollisions: function () {
    const data = this.data;
    this.getHeadPosition(this.head);
    if (!this.previous) this.previous = this.head.clone();
    const desired = this.head.clone();
    const dx = desired.x - this.previous.x;
    const dz = desired.z - this.previous.z;
    const boxes = Array.from(this.el.sceneEl.querySelectorAll('[furniture-collider]'),
      el => el.components['furniture-collider'].box
    ).filter(box => box && box.max.y > data.stepHeight && box.min.y < this.head.y + 0.3);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (data.radius / 2)));
    this.head.copy(this.previous);
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
    // Aplicar a correção ao rig: nunca escrever a pose local do headset.
    this.el.object3D.position.x += this.head.x - desired.x;
    this.el.object3D.position.z += this.head.z - desired.z;
    this.previous.copy(this.head);
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInput);
    this.left.removeEventListener('thumbstickmoved', this.onStick);
    this.rightController.removeEventListener('thumbstickmoved', this.onTurn);
    this.left.removeEventListener('controllerdisconnected', this.onDisconnect);
    this.rightController.removeEventListener('controllerdisconnected', this.onDisconnect);
  }
});
