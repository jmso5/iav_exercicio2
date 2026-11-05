AFRAME.registerComponent('sit-on-click', {
  schema: {
    // Distância horizontal à superfície do sofá, em unidades da cena.
    maxDistance: {default: 2.5},
    hoverScale: {default: 1.05},
    seatOffset: {type: 'vec3', default: {x: 0, y: 525, z: 30}}
  },

  init: function () {
    this.rig = this.el.sceneEl.querySelector('#player-rig');
    this.button = document.getElementById('stand-up');
    this.hint = document.getElementById('sofa-hint');
    this.pointers = new Set();
    this.saved = null;
    this.mesh = null;
    this.factor = 1;
    this.focused = false;
    this.head = new THREE.Vector3();
    this.onModel = () => {
      this.mesh = this.el.getObject3D('mesh');
      this.baseScale = this.mesh.scale.clone();
    };
    this.onEnter = event => this.pointers.add(event.detail.cursorEl || event.target);
    this.onLeave = event => this.pointers.delete(event.detail.cursorEl || event.target);
    this.onClick = event => this.sit(event.detail.cursorEl);
    this.onStand = () => { this.stand(); this.pointers.clear(); };
    this.onKey = event => {
      if (event.code === 'KeyE' && !event.repeat) this.stand();
    };
    this.onDisconnect = event => this.pointers.delete(event.target);
    this.el.addEventListener('model-loaded', this.onModel);
    this.el.addEventListener('mouseenter', this.onEnter);
    this.el.addEventListener('mouseleave', this.onLeave);
    this.el.addEventListener('click', this.onClick);
    this.button.addEventListener('click', this.onStand);
    window.addEventListener('keydown', this.onKey);
    this.el.sceneEl.addEventListener('leave-seat', this.onStand);
    this.controllers = Array.from(this.rig.querySelectorAll('[laser-controls]'));
    for (const controller of this.controllers) {
      controller.addEventListener('gripdown', this.onStand);
      controller.addEventListener('controllerdisconnected', this.onDisconnect);
    }
    if (this.el.getObject3D('mesh')) this.onModel();
  },

  isNear: function () {
    const player = this.rig.components['player-controls'];
    const box = this.el.components['furniture-collider'].box;
    if (!player || !box) return false;
    player.getHeadPosition(this.head);
    const x = THREE.MathUtils.clamp(this.head.x, box.min.x, box.max.x);
    const z = THREE.MathUtils.clamp(this.head.z, box.min.z, box.max.z);
    return Math.hypot(this.head.x - x, this.head.z - z) <= this.data.maxDistance;
  },

  tick: function (time, delta) {
    if (!this.mesh) return;
    const near = !this.saved && this.isNear();
    this.focused = near && this.pointers.size > 0;
    const target = this.focused ? this.data.hoverScale : 1;
    this.factor = THREE.MathUtils.lerp(this.factor, target, 1 - Math.exp(-12 * (delta || 0) / 1000));
    // Só o mesh visual aumenta: o collider e o assento mantêm as dimensões.
    this.mesh.scale.copy(this.baseScale).multiplyScalar(this.factor);
    const canvas = this.el.sceneEl.canvas;
    if (canvas) canvas.style.cursor = this.focused ? 'pointer' : '';
    this.hint.hidden = !near || this.rig.components['player-controls'].inVR;
    this.hint.textContent = this.focused ? 'Clica no sofá para te sentares' : 'Aponta para o sofá para te sentares';
  },

  sit: function (controller) {
    // Revalidar no clique: um laser longo não permite sentar à distância.
    if (this.saved || !this.mesh || !this.isNear()) return;
    const player = this.rig.components['player-controls'];
    this.mesh.scale.copy(this.baseScale);
    this.factor = 1;
    this.saved = {
      position: this.rig.object3D.position.clone(),
      rotation: this.rig.object3D.rotation.clone()
    };
    const offset = this.data.seatOffset;
    this.el.object3D.updateWorldMatrix(true, false);
    const seat = this.el.object3D.localToWorld(new THREE.Vector3(offset.x, offset.y, offset.z));
    const screen = this.el.sceneEl.querySelector('#tv-screen');
    const target = screen.object3D.getWorldPosition(new THREE.Vector3());
    player.seated = true;
    player.placeHead(seat, target);
    this.pointers.clear();
    this.hint.hidden = true;
    this.button.hidden = player.inVR;
    this.el.sceneEl.querySelector('#tv-message')?.setAttribute('visible', false);
    this.el.sceneEl.querySelector('#tv-menu')?.setAttribute('visible', true);
    this.pulse(controller);
  },

  pulse: function (controller) {
    const session = this.el.sceneEl.renderer.xr.getSession();
    const hand = controller && controller.getAttribute('laser-controls');
    if (!session || !hand) return;
    const source = Array.from(session.inputSources).find(source => source.handedness === hand.hand);
    const actuator = source && source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators[0];
    if (actuator) Promise.resolve(actuator.pulse(0.35, 60)).catch(() => {});
  },

  stand: function () {
    if (!this.saved) return;
    const player = this.rig.components['player-controls'];
    this.rig.object3D.position.copy(this.saved.position);
    this.rig.object3D.rotation.copy(this.saved.rotation);
    player.seated = false;
    player.previous = null;
    player.clearInput();
    this.saved = null;
    this.pointers.clear();
    this.button.hidden = true;
    this.el.sceneEl.querySelector('#tv-message')?.setAttribute('visible', true);
    this.el.sceneEl.querySelector('#tv-menu')?.components['tv-menu']?.close();
  },

  remove: function () {
    this.stand();
    if (this.mesh) this.mesh.scale.copy(this.baseScale);
    if (this.el.sceneEl.canvas) this.el.sceneEl.canvas.style.cursor = '';
    this.hint.hidden = true;
    this.el.removeEventListener('model-loaded', this.onModel);
    this.el.removeEventListener('mouseenter', this.onEnter);
    this.el.removeEventListener('mouseleave', this.onLeave);
    this.el.removeEventListener('click', this.onClick);
    this.button.removeEventListener('click', this.onStand);
    window.removeEventListener('keydown', this.onKey);
    this.el.sceneEl.removeEventListener('leave-seat', this.onStand);
    for (const controller of this.controllers) {
      controller.removeEventListener('gripdown', this.onStand);
      controller.removeEventListener('controllerdisconnected', this.onDisconnect);
    }
  }
});
