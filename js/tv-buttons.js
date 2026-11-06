AFRAME.registerComponent('tv-button', {
  schema: {
    action: {type: 'string'},
    label: {type: 'string'}
  },
  
  // Inicializa o botão, criando a sua aparência e definindo os eventos de interação
  init: function () {
    this.menuElement = this.el.closest('[tv-menu]');
    this.pointers = new Set();
    this.pressed = false;
    this.enabled = false;

    // Cria a aparência do botão
    this.body = document.createElement('a-box');
    this.body.setAttribute('width', '1.1');
    this.body.setAttribute('height', '0.9');
    this.body.setAttribute('depth', '0.12');
    this.body.setAttribute(
      'material',
      'shader: flat; color: #303842'
    );
    this.el.appendChild(this.body);

    // Cria o rótulo do botão, que é um texto 3D posicionado na frente do corpo do botão
    const label = document.createElement('a-text');
    label.setAttribute('value', this.data.label);
    label.setAttribute('position', '0 0 0.08');
    label.setAttribute('align', 'center');
    label.setAttribute('width', '1.9');
    label.setAttribute('wrap-count', '12');
    this.el.appendChild(label);

    // Adiciona classes e eventos de interação para o corpo do botão e o rótulo, permitindo que eles respondam a eventos de mouse e toque
    this.forwardedEvents = [];
    for (const part of [this.body, label]) {
      part.classList.add('clickable');
      for (const eventName of ['mouseenter', 'mouseleave', 'mousedown', 'mouseup', 'click']) {
        const handler = event => {
          event.stopPropagation();
          this.el.emit(eventName, event.detail, false);
        };
        part.addEventListener(eventName, handler);
        this.forwardedEvents.push({part, eventName, handler});
      }
    }
    
    this.el.addEventListener('mouseenter', event => { // Adiciona o cursor à lista de ponteiros quando aponta para o botão
      this.pointers.add(event.detail.cursorEl || event.target);
      this.paint();
    });

    this.el.addEventListener('mouseleave', event => { // Remove o cursor da lista de ponteiros quando deixa de apontar para o botão
      this.pointers.delete(event.detail.cursorEl || event.target);
      this.pressed = false;
      this.paint();
    });

    this.el.addEventListener('mousedown', () => { // Define o estado do botão como pressionado quando o jogador pressiona o botão do mouse ou toca na tela
      this.pressed = this.enabled;
      this.paint();
    });

    this.el.addEventListener('mouseup', () => { // Define o estado do botão como não pressionado quando o jogador solta o botão do mouse 
      this.pressed = false;
      this.paint();
    });

    // Quando o botão é clicado, verifica se a ação associada ao botão pode ser executada no menu da TV e, em caso afirmativo, executa a ação
    this.el.addEventListener('click', () => {
      const menu = this.menuElement.components['tv-menu'];

      // Revalidar no clique, mesmo que o aspeto ainda não tenha atualizado.
      if (!menu || !menu.canUse(this.data.action)) return;

      menu.execute(this.data.action);
      this.pressed = false;
      this.paint();
    });

    this.paint();
  },

  // Atualiza o estado do botão a cada frame, verificando se ele está habilitado e se há ponteiros sobre ele, e ajustando sua aparência de acordo
  tick: function () {
    const menu = this.menuElement.components['tv-menu'];
    const enabled = !!menu && menu.canUse(this.data.action);

    if (enabled === this.enabled) return;

    this.enabled = enabled;

    if (!enabled) {
      this.pointers.clear();
      this.pressed = false;
    }

    this.paint();
  },

  // Remove os eventos de interação do botão quando ele é removido da cena
  remove: function () {
    for (const {part, eventName, handler} of this.forwardedEvents) {
      part.removeEventListener(eventName, handler);
    }
  },

  // Atualiza a aparência do botão com base em seu estado atual, alterando sua cor e escala dependendo se ele está habilitado, pressionado ou com o cursor sobre ele
  paint: function () {
    const hovered = this.enabled && this.pointers.size > 0;

    const color = !this.enabled ? '#20242a'
      : this.pressed ? '#725326'
      : hovered ? '#b38b48'
      : '#303842';

    this.body.setAttribute('material', 'color', color);

    // Aumento no hover
    this.el.object3D.scale.setScalar(hovered ? 1.05 : 1);

    // Todo o botão recua quando pressionado
    this.el.object3D.position.z = this.pressed ? -0.04 : 0;
  }
});
