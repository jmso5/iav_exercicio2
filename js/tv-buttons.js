AFRAME.registerComponent('tv-button', {
  schema: {
    action: {type: 'string'},
    label: {type: 'string'}
  },

  init: function () {
    this.menuElement = this.el.closest('[tv-menu]');
    this.pointers = new Set();
    this.pressed = false;
    this.enabled = false;

    this.body = document.createElement('a-box');
    this.body.setAttribute('width', '1.1');
    this.body.setAttribute('height', '0.9');
    this.body.setAttribute('depth', '0.12');
    this.body.setAttribute(
      'material',
      'shader: flat; color: #303842'
    );
    this.el.appendChild(this.body);

    const label = document.createElement('a-text');
    label.setAttribute('value', this.data.label);
    label.setAttribute('position', '0 0 0.08');
    label.setAttribute('align', 'center');
    label.setAttribute('width', '1.9');
    label.setAttribute('wrap-count', '12');
    this.el.appendChild(label);

    // O raycaster atinge o mesh do corpo ou do texto, não o grupo pai.
    // Encaminhar ambos para os mesmos handlers, preservando cursorEl
    // (câmara/rato, comando esquerdo ou comando direito) e intersection.
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

    this.el.addEventListener('mouseenter', event => {
      this.pointers.add(event.detail.cursorEl || event.target);
      this.paint();
    });

    this.el.addEventListener('mouseleave', event => {
      this.pointers.delete(event.detail.cursorEl || event.target);
      this.pressed = false;
      this.paint();
    });

    this.el.addEventListener('mousedown', () => {
      this.pressed = this.enabled;
      this.paint();
    });

    this.el.addEventListener('mouseup', () => {
      this.pressed = false;
      this.paint();
    });

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

  remove: function () {
    for (const {part, eventName, handler} of this.forwardedEvents) {
      part.removeEventListener(eventName, handler);
    }
  },

  paint: function () {
    const hovered = this.enabled && this.pointers.size > 0;

    const color = !this.enabled ? '#20242a'
      : this.pressed ? '#725326'
      : hovered ? '#b38b48'
      : '#303842';

    this.body.setAttribute('material', 'color', color);

    // Aumento no hover.
    this.el.object3D.scale.setScalar(hovered ? 1.05 : 1);

    // Todo o botão recua quando pressionado.
    this.el.object3D.position.z = this.pressed ? -0.04 : 0;
  }
});
