// Caixas dos móveis, consultadas pelo movimento do jogador e pela interação com o sofá
AFRAME.registerComponent('furniture-collider', {
  init: function () {
    this.box = null;
    this.updateBounds = () => { // Atualiza a caixa de colisão do móvel, caso o modelo seja carregado ou alterado
      const mesh = this.el.getObject3D('mesh'); // Obtém o mesh do modelo 3D do móvel
      if (!mesh) {
        return;
      }
      mesh.updateWorldMatrix(true, true); // Atualiza a matriz de mundo do mesh para garantir que a caixa de colisão esteja correta
      this.box = new THREE.Box3().setFromObject(mesh); // Cria uma nova caixa de colisão a partir do mesh do móvel
    };
    // Adiciona um listener para o evento 'model-loaded' para atualizar a caixa de colisão quando o modelo for carregado
    this.el.addEventListener('model-loaded', this.updateBounds);
    this.updateBounds();
  },
  // Remove o listener quando o componente é removido
  remove: function () {
    this.el.removeEventListener('model-loaded', this.updateBounds);
  }
});
