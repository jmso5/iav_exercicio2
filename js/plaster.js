// Textura das paredes
let plasterImages;
AFRAME.registerComponent('plaster', {
  schema: {repeat: {type: 'vec2', default: {x: 12, y: 5.5}}},
  init: function () {
    if (!plasterImages) {
      const size = 128;
      const height = new Float32Array(size * size);
      let seed = 73;
      for (let i = 0; i < height.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        height[i] = seed / 4294967296;
      }
      const color = document.createElement('canvas');
      const normal = document.createElement('canvas');
      color.width = color.height = normal.width = normal.height = size;
      const colorContext = color.getContext('2d');
      const normalContext = normal.getContext('2d');
      const colorData = colorContext.createImageData(size, size);
      const normalData = normalContext.createImageData(size, size);
      const sample = (x, y) => height[((y + size) % size) * size + (x + size) % size];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const shade = 249 + Math.round(sample(x, y) * 6);
          colorData.data.set([shade, shade, shade, 255], i);
          const nx = (sample(x - 1, y) - sample(x + 1, y)) * 0.3;
          const ny = (sample(x, y - 1) - sample(x, y + 1)) * 0.3;
          const length = Math.hypot(nx, ny, 1);
          normalData.data.set([
            Math.round((nx / length + 1) * 127.5),
            Math.round((ny / length + 1) * 127.5),
            Math.round((1 / length + 1) * 127.5), 255
          ], i);
        }
      }
      colorContext.putImageData(colorData, 0, 0);
      normalContext.putImageData(normalData, 0, 0);
      plasterImages = {color, normal};
    }
    this.colorMap = new THREE.CanvasTexture(plasterImages.color);
    this.colorMap.colorSpace = THREE.SRGBColorSpace;
    this.normalMap = new THREE.CanvasTexture(plasterImages.normal);
    for (const texture of [this.colorMap, this.normalMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(this.data.repeat.x, this.data.repeat.y);
    }
    this.applyMaterial = () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      mesh.material.map = this.colorMap;
      mesh.material.normalMap = this.normalMap;
      mesh.material.normalScale.set(0.22, 0.22);
      mesh.material.needsUpdate = true;
    };
    this.el.addEventListener('object3dset', this.applyMaterial);
    this.el.addEventListener('materialtextureloaded', this.applyMaterial);
    this.applyMaterial();
  },
  remove: function () {
    this.el.removeEventListener('object3dset', this.applyMaterial);
    this.el.removeEventListener('materialtextureloaded', this.applyMaterial);
    this.colorMap.dispose();
    this.normalMap.dispose();
  }
});
