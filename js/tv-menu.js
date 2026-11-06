AFRAME.registerComponent('tv-menu', {
  init: function () {
    this.items = [
      {
        type: 'image',
        title: 'Fotografia 1',
        thumbnail: 'images/photo1.JPG',
        source: 'images/photo1.JPG'
      },
      {
        type: 'image',
        title: 'Fotografia 2',
        thumbnail: 'images/photo2.JPG',
        source: 'images/photo2.JPG'
      },
      {
        type: 'video',
        title: 'Video 1',
        thumbnail: 'images/video1.png',
        source: 'videos/video1.mp4'
      },
      {
        type: 'video',
        title: 'Video 2',
        thumbnail: 'images/video2.png',
        source: 'videos/video2.mp4'
      }
    ];

    this.selectedIndex = 0;
    this.view = 'menu';
    this.frames = [];

    // Grupo que contém o título e as miniaturas.
    this.grid = document.createElement('a-entity');
    this.el.appendChild(this.grid);

    const title = document.createElement('a-text');
    title.setAttribute('value', 'Galeria');
    title.setAttribute('position', '0 1.85 0');
    title.setAttribute('align', 'center');
    title.setAttribute('width', '6');
    this.grid.appendChild(title);

    this.items.forEach((item, index) => {
      const card = document.createElement('a-entity');

      const x = index % 2 === 0 ? -1.95 : 1.95;
      const y = 0.8 - Math.floor(index / 2) * 1.7;

      card.setAttribute('position', `${x} ${y} 0`);

      // Retângulo atrás da imagem, usado como moldura.
      const frame = document.createElement('a-plane');
      frame.setAttribute('width', '3.32');
      frame.setAttribute('height', '1.37');
      frame.setAttribute('material', 'shader: flat; color: #354454');
      card.appendChild(frame);
      this.frames.push(frame);

      const thumbnail = document.createElement('a-image');
      thumbnail.setAttribute('src', item.thumbnail);
      thumbnail.setAttribute('position', '0 0 0.02');
      thumbnail.setAttribute('width', '3.2');
      thumbnail.setAttribute('height', '1.25');
      card.appendChild(thumbnail);

      const label = document.createElement('a-text');
      label.setAttribute('value', item.title);
      label.setAttribute('position', '0 -0.8 0.03');
      label.setAttribute('align', 'center');
      label.setAttribute('width', '3.3');
      label.setAttribute('wrap-count', '25');
      card.appendChild(label);

      this.grid.appendChild(card);
    });

    // Superfície usada apenas para fotografias.
    this.preview = document.createElement('a-image');
    this.preview.setAttribute('position', '0 0.15 0.04');
    this.preview.setAttribute('width', '7.6');
    this.preview.setAttribute('height', '3.8');
    this.preview.setAttribute('visible', false);
    this.el.appendChild(this.preview);

    this.caption = document.createElement('a-text');
    this.caption.setAttribute('position', '0 -2 0.05');
    this.caption.setAttribute('align', 'center');
    this.caption.setAttribute('width', '7');
    this.caption.setAttribute('wrap-count', '55');
    this.caption.setAttribute('visible', false);
    this.el.appendChild(this.caption);

    this.currentVideo = null;
    this.playRequest = 0;

    // Vídeo 16:9, com espaço para a legenda por baixo.
    this.videoPlane = document.createElement('a-video');
    this.videoPlane.setAttribute('position', '0 0.15 0.04');
    this.videoPlane.setAttribute('width', '6.75');
    this.videoPlane.setAttribute('height', '3.796875');
    this.videoPlane.setAttribute('visible', false);
    this.el.appendChild(this.videoPlane);

    this.render();
  },

  // Determina se cada ação está disponível.
  canUse: function (action) {
    const player = this.el.sceneEl
      .querySelector('#player-rig')
      .components['player-controls'];

    if (!player || !player.seated || !this.items.length) return false;

    if (action === 'open') return this.view === 'menu';
    if (action === 'back') return this.view === 'content';

    if (action === 'previous' || action === 'next') {
      return this.view === 'menu';
    }

    return false;
  },

  execute: function (action) {
    if (!this.canUse(action)) return;

    if (action === 'previous') {
      this.selectedIndex =
        (this.selectedIndex - 1 + this.items.length) % this.items.length;
    }

    if (action === 'next') {
      this.selectedIndex =
        (this.selectedIndex + 1) % this.items.length;
    }

    if (action === 'open') this.view = 'content';
    if (action === 'back') this.view = 'menu';

    this.render();
  },

  stopVideo: function () {
    // Ignorar erros de pedidos de reprodução entretanto cancelados.
    this.playRequest++;
    if (this.currentVideo) {
      this.currentVideo.pause();
      if (this.currentVideo.readyState > 0) {
        this.currentVideo.currentTime = 0;
      }
    }
    this.currentVideo = null;
    this.videoPlane.setAttribute('visible', false);
  },

  close: function () {
    this.view = 'menu';
    this.render();
    this.el.setAttribute('visible', false);
  },

  remove: function () {
    this.stopVideo();
  },

  render: function () {
    this.stopVideo();
    const inMenu = this.view === 'menu';

    this.grid.setAttribute('visible', inMenu);
    this.preview.setAttribute('visible', false);
    this.caption.setAttribute('visible', !inMenu);

    // Destacar a miniatura selecionada.
    this.frames.forEach((frame, index) => {
      frame.setAttribute(
        'material',
        'color',
        index === this.selectedIndex ? '#e4bb78' : '#354454'
      );
    });

    if (inMenu) return;

    const item = this.items[this.selectedIndex];
    this.caption.setAttribute('value', item.title);

    if (item.type === 'image') {
      // Remover a superfície anterior e o respetivo material.
      this.preview.remove();

      // Cada fotografia recebe uma superfície nova.
      this.preview = document.createElement('a-image');
      this.preview.setAttribute('position', '0 0.15 0.04');
      this.preview.setAttribute('width', '7.6');
      this.preview.setAttribute('height', '3.8');
      this.preview.setAttribute('src', item.source);

      this.el.appendChild(this.preview);
      return;
    }

    if (item.type === 'video') {
      // Procurar o player criado no HTML.
      const video = document.querySelector('#tv-player');

      if (!video || video.tagName !== 'VIDEO') {
        this.caption.setAttribute('value', 'Video nao encontrado');
        return;
      }

      // Usar o caminho definido em this.items.
      if (video.getAttribute('src') !== item.source) {
        video.setAttribute('src', item.source);
        video.load();
      }

      this.currentVideo = video;

      // A superfície 3D mostra o conteúdo deste player.
      this.videoPlane.setAttribute('src', '#tv-player');
      this.videoPlane.setAttribute('visible', true);

      const request = this.playRequest;

      video.play().catch(error => {
        if (request !== this.playRequest) return;

        this.caption.setAttribute(
          'value',
          'Nao foi possivel reproduzir o video'
        );

        console.error('Erro ao reproduzir:', error);
      });

      return;
    }

    this.caption.setAttribute('value', 'Tipo de conteudo desconhecido');
  }
});
