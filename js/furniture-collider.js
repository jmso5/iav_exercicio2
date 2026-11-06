// Caixas dos móveis, consultadas pelo movimento do jogador e pela interação com o sofá.
AFRAME.registerComponent('furniture-collider', {
  init: function () {
    this.box = null;
    this.updateBounds = () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) {
        return;
      }
      mesh.updateWorldMatrix(true, true);
      this.box = new THREE.Box3().setFromObject(mesh);
    };
    this.el.addEventListener('model-loaded', this.updateBounds);
    this.updateBounds();
  },
  remove: function () {
    this.el.removeEventListener('model-loaded', this.updateBounds);
  }
});
