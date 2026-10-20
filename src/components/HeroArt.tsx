/**
 * Decorative silver-module illustration. Every shape is static, untabbable and
 * labelled as decoration; nothing here represents a measured value.
 */
export function HeroArt(): JSX.Element {
  return (
    <figure className="hero-art hidden lg:block">
      <div className="hero-art__stage">
        <svg viewBox="0 0 520 520" role="presentation" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="art-silver" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="art-silver-0" />
              <stop offset=".28" className="art-silver-1" />
              <stop offset=".55" className="art-silver-2" />
              <stop offset=".78" className="art-silver-3" />
              <stop offset="1" className="art-silver-4" />
            </linearGradient>
            <linearGradient id="art-glass" x1="0" y1="0" x2=".6" y2="1">
              <stop offset="0" className="art-glass-0" stopOpacity=".92" />
              <stop offset=".45" className="art-glass-1" stopOpacity=".28" />
              <stop offset="1" className="art-glass-2" stopOpacity=".06" />
            </linearGradient>
            <linearGradient id="art-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="art-edge-0" stopOpacity=".95" />
              <stop offset="1" className="art-edge-1" stopOpacity=".35" />
            </linearGradient>
            <pattern id="art-dots" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle className="art-dot-pattern" cx="1" cy="1" r=".8" />
            </pattern>
            <filter id="art-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow className="art-drop-shadow" dx="0" dy="18" stdDeviation="16" floodOpacity=".16" />
            </filter>
          </defs>

          {/* Ecological orbits */}
          <g className="art-orbit">
            <circle cx="260" cy="260" r="236" strokeOpacity=".45" strokeDasharray="2 8" vectorEffect="non-scaling-stroke" />
            <circle cx="260" cy="260" r="190" strokeOpacity=".72" vectorEffect="non-scaling-stroke" />
            <circle cx="260" cy="260" r="146" strokeOpacity=".45" strokeDasharray="1 6" vectorEffect="non-scaling-stroke" />
            <circle cx="260" cy="260" r="222" strokeOpacity=".38" strokeWidth="6" strokeDasharray="1 11" />
          </g>

          {/* Glass pane */}
          <rect
            className="art-glass-pane"
            x="188"
            y="118"
            width="176"
            height="112"
            rx="6"
            transform="rotate(6 276 174)"
          />

          {/* Unlabelled nodes: atmosphere only */}
          <g>
            <line className="art-node-line" x1="375" y1="350" x2="404" y2="372" />
            <line className="art-node-line" x1="176" y1="141" x2="155" y2="110" />
            <circle className="art-node" cx="82" cy="195" r="5" />
            <circle className="art-node-core" cx="82" cy="195" r="1.5" />
            <circle className="art-node" cx="410" cy="377" r="5" />
            <circle className="art-node-core" cx="410" cy="377" r="1.5" />
            <circle className="art-node" cx="151" cy="104" r="4" />
            <circle className="art-node-core" cx="151" cy="104" r="1.2" />
          </g>

          {/* Silver module */}
          <g transform="rotate(-8 260 260)">
            <rect
              className="art-module-base art-shadow"
              x="158"
              y="196"
              width="204"
              height="148"
              rx="6"
              filter="url(#art-shadow)"
            />
            <rect
              className="art-module-face"
              x="158"
              y="176"
              width="204"
              height="148"
              rx="6"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              className="art-module-gloss"
              x="158"
              y="176"
              width="204"
              height="148"
              rx="6"
              vectorEffect="non-scaling-stroke"
            />
            <path className="art-module-highlight" d="M170 188H350" />

            <rect
              className="art-module-dots"
              x="182"
              y="200"
              width="100"
              height="64"
              rx="2"
            />
            <rect className="art-signal-bar" x="292" y="200" width="6" height="64" />

            <g className="art-hairlines">
              <path d="M306 206h34" />
              <path d="M306 218h26" />
              <path d="M306 230h30" />
              <path d="M306 242h20" />
            </g>

            <text className="art-label" x="182" y="300" fontSize="8.5">
              DSH / MODULE
            </text>

            <g className="art-screw">
              <circle cx="170" cy="188" r="2.2" />
              <circle cx="350" cy="188" r="2.2" />
              <circle cx="170" cy="312" r="2.2" />
              <circle cx="350" cy="312" r="2.2" />
            </g>
          </g>

          {/* Brand signal arc — decoration, not a status light */}
          <path className="art-signal-arc" d="M355 96A190 190 0 0 1 447 227" />
        </svg>
      </div>
      <figcaption className="hero-art__caption stamp">
        FIG.01 / SILVER MODULE · 装饰示意，不表示数据
      </figcaption>
    </figure>
  );
}

/** Compact CSS-only variant used below 1024px. */
export function ModuleMark(): JSX.Element {
  return (
    <span className="module-mark" aria-hidden="true">
      <span className="module-mark__rail" />
      <span className="module-mark__label">DSH</span>
    </span>
  );
}
