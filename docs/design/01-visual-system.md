# 01 · 视觉系统 — Silver Instrument / 浅色工业未来

> **项目**：DSH Plugin Health Monitor（DSH 插件生态观测实验室）
> **基线**：`ui/light-tech-redesign` @ `785c8f2 feat(ui): redesign dashboard with light data theme`
> **依据**：`docs/design/BRIEF.md`（下称 BRIEF）。本文与 BRIEF 冲突时，以 BRIEF 为准。
> **范围**：视觉语言、设计令牌、组件外观、ECharts 浅色主题、装饰规则、390/768/1440 三档密度。
> **不包含**：信息架构、页面布局与交互流程（见 `02-ux-layout.md`）、源码实现、数据口径。
> **状态**：可交付前端实现。文中的 CSS/TS/SVG 均为**落地规格**，本轮未修改任何源码。

---

## 0. 一句话与五条硬规则

**一句话**：极浅灰画布上的银色仪器——黑色读数、克制的红、精确的 1px 结构、克制的圆角；装饰只做气氛，绝不冒充数据。

| # | 硬规则 | 可检验标准 |
|---|---|---|
| 1 | 结构靠线与刻度，不靠阴影和大圆角 | UI 矩形/控件圆角 ≤ 6px（圆形状态灯除外）；阴影不超过 `0 2px 6px` 的日常强度 |
| 2 | 品牌红只给动作、当前项与品牌，不给数据 | 图表绘图区、风险标签、分类点、排行榜条形内不得出现 `brand` |
| 3 | 风险用锈红/琥珀/钢蓝/中性 + 形状 + 文字 | 灰度截图下仍能区分品牌按钮与风险标签；风险标签必有图标和中文 |
| 4 | 银灰只做结构与主视觉 | 银灰不承载任何数值含义；数据只使用墨色/系列色 |
| 5 | 装饰必须能被识别为装饰 | 装饰无单位、无百分比、无时间、无交互、`aria-hidden` |

### 0.1 与需求的对照

| 需求 | 章节 |
|---|---|
| 1) 完整设计令牌 + Tailwind 映射 | §1、§2 |
| 2) 点阵英文标题/编号轻量实现 | §3.5 |
| 3) 银色半透明主视觉（CSS/SVG） | §5 |
| 4) 组件规范 | §6 |
| 5) ECharts 浅色主题 | §7 |
| 6) 品牌红与风险红区分 | §8 |
| 7) 装饰与真实指标区分 | §9 |
| 8) 390/768/1440 字号与密度 | §10 |

### 0.2 相对 HEAD 的关键变化

| 项 | HEAD `785c8f2` | 本规范 |
|---|---|---|
| 主色 | 蓝色 `#2563EB` | 品牌红 `#D71920`，且与数据色解耦 |
| 画布 | 冷蓝白 `#F5F7FA` | 中性浅灰 `#F4F4F2` |
| 面板圆角 | 8px | 6px |
| 图表数据色 | 蓝 / 青 | 石墨墨色 / 氧化青 |
| 风险高 | 玫红 `#BE123C` | 锈红 `#9E2E12`，与品牌红分工 |
| 字体 | 系统无衬线 + 等宽 | 不变，另加 CSS 半调点阵标题（无外网字体） |
| 主视觉 | 无 | 内联 SVG 银色模块 + 轨道（无 3D 库） |

---

## 1. 色彩系统

### 1.1 三层令牌

1. **原始层**：`--canvas`、`--metal-200` 等 RGB 三元组，只允许在 `:root` 定义。
2. **语义层**：`brand`、`risk.high`、`series.maintenance`、`line.control`。组件只准用这一层。
3. **组件层**：`.btn-primary`、`.risk-chip` 等，由语义层组合，不出现新的 hex。

**唯一例外**：ECharts 需要实色字符串（见 §7）；内联 SVG 插画为了自包含使用字面 hex（见 §5.3，必须与 §1.2 同值）。两处都在文档内列出同步说明，禁止在其他组件写 hex。

### 1.2 `:root` 完整令牌

> 颜色令牌全部为 `R G B` 三元组，直接适配现有 `rgb(var(--x) / <alpha-value>)` 机制；布局与圆角为长度值。
> 别名（如 `--accent: var(--brand)`）解析后仍是三元组；Tailwind 的 `/95` 透明度语法继续有效。

```css
@layer base {
  :root {
    color-scheme: light;
    --shell: 1400px;

    /* ── 画布与面板 ───────────────────────────── */
    --canvas: 244 244 242;          /* #F4F4F2  页面底 */
    --canvas-deep: 238 238 234;     /* #EEEEEA  下沉区/分段底 */
    --surface: 255 255 255;         /* #FFFFFF  内容面板 */
    --surface-subtle: 249 249 247;  /* #F9F9F7  次级面板/表头 */
    --surface-sunken: 236 236 232;  /* #ECECE8  轨道/骨架/空槽 */

    /* ── 银灰结构 ─────────────────────────────── */
    --metal-100: 228 228 224;       /* #E4E4E0  银灰结构面 */
    --metal-200: 201 201 196;       /* #C9C9C4  银灰强线/结构 */
    --metal-300: 176 176 170;       /* #B0B0AA  金属暗边/刻度 */

    /* ── 边框与结构线 ─────────────────────────── */
    --line-hairline: 234 234 230;   /* #EAEAE6  1px 内部分隔 */
    --line: 223 223 218;            /* #DFDFDA  1px 面板边框 */
    --line-strong: 201 201 196;     /* #C9C9C4  1px 强调分隔/表头 */
    --line-control: 138 138 132;    /* #8A8A84  表单控件边界，白底 3.47:1 */
    --rule-ink: 26 26 26;           /* #1A1A1A  1px 数据带/章节上沿 */

    /* ── 文字 ─────────────────────────────────── */
    --fg-primary: 26 26 26;         /* #1A1A1A  标题/读数，白底 17.4:1 */
    --fg-body: 74 74 70;            /* #4A4A46  正文，白底 8.9:1 */
    --fg-secondary: 90 90 85;       /* #5A5A55  次正文，白底 6.9:1 */
    --fg-tertiary: 104 104 100;     /* #686864  辅助文字，白底 5.6:1 */
    --fg-disabled: 150 150 144;     /* #969690  仅禁用态，白底 2.97:1 */
    --fg-inverse: 255 255 255;

    /* ── 品牌红（动作/身份，不表达数据）──────── */
    --brand: 215 25 32;             /* #D71920  BRIEF 指定 */
    --brand-strong: 178 18 24;      /* #B21218  hover */
    --brand-active: 140 12 18;      /* #8C0C12  active */
    --brand-text: 176 16 22;        /* #B01016  白底/画布上的红色文字 */
    --brand-soft: 253 237 236;      /* #FDEDEC */
    --brand-line: 241 190 187;      /* #F1BEBB */

    /* ── 风险语义（独立于品牌红）────────────── */
    --risk-high: 158 46 18;         /* #9E2E12  锈红 */
    --risk-high-soft: 251 238 233;  /* #FBEEE9 */
    --risk-high-line: 233 195 180;  /* #E9C3B4 */
    --risk-medium: 124 82 8;        /* #7C5208  琥珀褐 */
    --risk-medium-soft: 252 245 230;/* #FCF5E6 */
    --risk-medium-line: 232 213 168;/* #E8D5A8 */
    --risk-low: 44 82 100;          /* #2C5264  钢蓝 */
    --risk-low-soft: 240 245 248;   /* #F0F5F8 */
    --risk-low-line: 203 217 226;   /* #CBD9E2 */
    --risk-unknown: 90 90 85;       /* #5A5A55  中性 */
    --risk-unknown-soft: 244 244 241;/* #F4F4F1 */
    --risk-unknown-line: 216 216 210;/* #D8D8D2 */

    /* ── 系统状态（与风险等级分开命名）────────── */
    --success: 28 100 68;           /* #1C6444  来源正常/完成 */
    --success-soft: 238 246 241;    /* #EEF6F1 */
    --success-line: 185 216 200;    /* #B9D8C8 */
    --warning: var(--risk-medium);  /* 系统警告沿用琥珀，语义由文案区分 */
    --warning-soft: var(--risk-medium-soft);
    --warning-line: var(--risk-medium-line);
    --danger: var(--risk-high);     /* 数据加载失败/系统错误 */
    --danger-soft: var(--risk-high-soft);
    --danger-line: var(--risk-high-line);

    /* ── 数据系列（图表/条形/覆盖度）──────────── */
    --series-popularity: 38 38 36;  /* #262624  石墨 */
    --series-maintenance: 47 94 88; /* #2F5E58  氧化青 */
    --series-bar: 65 65 61;         /* #41413D  条形 */
    --series-bar-hover: 26 26 26;   /* #1A1A1A */

    /* ── 图表专用 ─────────────────────────────── */
    --chart-grid: 234 234 230;      /* #EAEAE6 */
    --chart-axis: 104 104 100;      /* #686864 */
    --chart-axis-line: 138 138 132; /* #8A8A84  白底 3.47:1 */
    --chart-threshold: 138 138 132; /* #8A8A84  阈值虚线 */
    --chart-gap: 229 229 224;       /* #E5E5E0  缺数底纹 */

    /* ── 焦点与选择 ───────────────────────────── */
    --focus: 26 26 26;              /* #1A1A1A  2px outline */
    --selection: 241 190 187;       /* #F1BEBB */

    /* ── 阴影（均为中性墨色，无彩色阴影）──────── */
    --shadow-panel: 0 1px 2px rgba(26, 26, 26, 0.05);
    --shadow-raise: 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 6px rgba(26, 26, 26, 0.06);
    --shadow-pop: 0 16px 40px -16px rgba(26, 26, 26, 0.22), 0 1px 2px rgba(26, 26, 26, 0.06);
    --shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(26, 26, 26, 0.08);
    --shadow-art: 0 24px 60px -28px rgba(26, 26, 26, 0.35);

    /* ── 布局与圆角 ───────────────────────────── */
    --gutter: 1rem;
    --section-gap: 2.5rem;
    --panel-pad: 1rem;
    --radius-chip: 2px;
    --radius-control: 4px;
    --radius-panel: 6px;

    /* ── 兼容别名（现有类名继续可用）──────────── */
    --accent: var(--brand);
    --accent-hover: var(--brand-strong);
    --accent-active: var(--brand-active);
    --accent-soft: var(--brand-soft);
    --accent-line: var(--brand-line);
    --teal: var(--series-maintenance);
    --teal-soft: 241 246 244;
  }
}
```

### 1.3 基础层落地

```css
* { border-color: rgb(var(--line)); }

html { background: rgb(var(--canvas)); }

body {
  @apply min-h-screen bg-canvas font-sans text-content antialiased;
  background-image: none; /* 点阵只出现在局部容器，不做全屏底纹 */
}

::selection {
  background: rgb(var(--selection));
  color: rgb(var(--fg-primary));
}

/* 统一焦点：深墨 outline，替代原来的蓝色 ring */
:where(button, a, input, select, summary, [tabindex]):focus-visible {
  outline: 2px solid rgb(var(--focus));
  outline-offset: 2px;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: rgb(var(--canvas)); }
::-webkit-scrollbar-thumb {
  background: rgb(var(--metal-200));
  border: 2px solid rgb(var(--canvas));
  border-radius: 6px;
}
::-webkit-scrollbar-thumb:hover { background: rgb(var(--line-control)); }
```

排版/数据基础类（与 §3 对应）：

```css
.eyebrow {
  @apply text-2xs font-medium tracking-label text-content-muted;
}

.stamp {
  @apply font-mono text-micro uppercase tracking-stamp text-content-muted;
}

.index {
  @apply font-mono text-micro tracking-index text-content-muted;
  font-variant-numeric: tabular-nums;
}

.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.readout {
  @apply font-semibold leading-none tracking-display text-content-primary;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.timestamp {
  @apply font-mono text-2xs text-content-muted;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
```

### 1.4 对比度校验（WCAG 2.x 相对亮度）

| 组合 | 比值 | 结论 |
|---|---:|---|
| `fg-primary` #1A1A1A / 白 | 17.40 | AAA |
| `fg-primary` / 画布 #F4F4F2 | 15.80 | AAA |
| `fg-body` #4A4A46 / 白 | 8.90 | AAA |
| `fg-body` / 画布 | 8.08 | AAA |
| `fg-secondary` #5A5A55 / 白 | 6.93 | AA |
| `fg-tertiary` #686864 / 白 | 5.60 | AA |
| `fg-tertiary` / 画布 | 5.08 | AA |
| 白字 / `brand` #D71920 | 5.19 | AA（14px 可用） |
| `brand` / 白（红色文字） | 5.19 | AA |
| `brand` / 画布 | 4.71 | AA（建议 ≥14px 使用） |
| `brand-text` #B01016 / 画布 | 6.50 | AA |
| 白字 / `brand-strong` | 7.02 | AAA |
| `risk-high` #9E2E12 / `risk-high-soft` | 6.49 | AA |
| `risk-high` / 白 | 7.36 | AAA |
| `risk-medium` #7C5208 / `risk-medium-soft` | 6.31 | AA |
| `risk-low` #2C5264 / `risk-low-soft` | 7.65 | AAA |
| `risk-unknown` #5A5A55 / `risk-unknown-soft` | 6.29 | AA |
| `success` #1C6444 / 白 | 7.10 | AAA |
| `line-control` #8A8A84 / 白 | 3.47 | 非文本 3:1 通过 |
| `line-strong` #C9C9C4 / 白 | 1.66 | 仅装饰/分隔，不可作控件边界 |
| `fg-disabled` #969690 / 白 | 2.97 | 仅禁用态（豁免） |

**规则**：
- 正文/辅助文字最低 12px 且 ≥4.5:1；11px 只用于拉丁等宽戳记/坐标轴。
- 控件边界使用 `line-control`，不要用 `line-strong`（1.66 不满足非文本对比）。
- 品牌红 <14px 的文字优先用 `brand-text`；`brand` 只用于 ≥14px 或实心填充上的白字。
- 任何“红色小字 + 浅色底”都必须实测，不靠肉眼估计。

### 1.5 面积配比

经验目标：**中性 90%（画布/白/银灰）+ 墨色 7% + 风险色 ≤2% + 品牌红 ≤1%**。
- 一个视口内最多 1 个品牌红实心主按钮、1 条品牌红激活下划线、1 个品牌标识。
- 品牌红还可用于“当前项”和 2px 品牌刻度（如方法页步骤左条），但不得编码数值或风险。
- 品牌红实心面积不超过可视区域的约 2%。
- 风险色只出现在标签、2px 左条、气泡描边、状态灯等小面积元素上。

> 本轮只做浅色。不添加 `prefers-color-scheme: dark`，也不保留暗色 token；`color-scheme: light` 固定。

---

## 2. Tailwind 映射

### 2.1 `tailwind.config.ts`（extend 目标）

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--canvas) / <alpha-value>)',
          deep: 'rgb(var(--canvas-deep) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        metal: {
          100: 'rgb(var(--metal-100) / <alpha-value>)',
          200: 'rgb(var(--metal-200) / <alpha-value>)',
          300: 'rgb(var(--metal-300) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          hairline: 'rgb(var(--line-hairline) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
          control: 'rgb(var(--line-control) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--fg-body) / <alpha-value>)',
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-tertiary) / <alpha-value>)',
          disabled: 'rgb(var(--fg-disabled) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          active: 'rgb(var(--brand-active) / <alpha-value>)',
          text: 'rgb(var(--brand-text) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          line: 'rgb(var(--brand-line) / <alpha-value>)',
        },
        risk: {
          high: {
            DEFAULT: 'rgb(var(--risk-high) / <alpha-value>)',
            soft: 'rgb(var(--risk-high-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-high-line) / <alpha-value>)',
          },
          medium: {
            DEFAULT: 'rgb(var(--risk-medium) / <alpha-value>)',
            soft: 'rgb(var(--risk-medium-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-medium-line) / <alpha-value>)',
          },
          low: {
            DEFAULT: 'rgb(var(--risk-low) / <alpha-value>)',
            soft: 'rgb(var(--risk-low-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-low-line) / <alpha-value>)',
          },
          unknown: {
            DEFAULT: 'rgb(var(--risk-unknown) / <alpha-value>)',
            soft: 'rgb(var(--risk-unknown-soft) / <alpha-value>)',
            line: 'rgb(var(--risk-unknown-line) / <alpha-value>)',
          },
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
          line: 'rgb(var(--success-line) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          line: 'rgb(var(--warning-line) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          line: 'rgb(var(--danger-line) / <alpha-value>)',
        },
        series: {
          popularity: 'rgb(var(--series-popularity) / <alpha-value>)',
          maintenance: 'rgb(var(--series-maintenance) / <alpha-value>)',
          bar: 'rgb(var(--series-bar) / <alpha-value>)',
          'bar-hover': 'rgb(var(--series-bar-hover) / <alpha-value>)',
        },
        chart: {
          grid: 'rgb(var(--chart-grid) / <alpha-value>)',
          axis: 'rgb(var(--chart-axis) / <alpha-value>)',
          'axis-line': 'rgb(var(--chart-axis-line) / <alpha-value>)',
          threshold: 'rgb(var(--chart-threshold) / <alpha-value>)',
          gap: 'rgb(var(--chart-gap) / <alpha-value>)',
        },
        // ── 兼容别名：现有 JSX 不必全量改名 ──
        accent: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-strong) / <alpha-value>)',
          active: 'rgb(var(--brand-active) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          line: 'rgb(var(--brand-line) / <alpha-value>)',
        },
        teal: {
          DEFAULT: 'rgb(var(--series-maintenance) / <alpha-value>)',
          bright: 'rgb(var(--series-maintenance) / <alpha-value>)',
          soft: 'rgb(var(--teal-soft) / <alpha-value>)',
        },
        ink: {
          950: 'rgb(var(--canvas) / <alpha-value>)',
          900: 'rgb(var(--surface) / <alpha-value>)',
          850: 'rgb(var(--surface) / <alpha-value>)',
          800: 'rgb(var(--surface-subtle) / <alpha-value>)',
          750: 'rgb(var(--surface-sunken) / <alpha-value>)',
          700: 'rgb(var(--line) / <alpha-value>)',
          600: 'rgb(var(--line-strong) / <alpha-value>)',
          500: 'rgb(var(--fg-tertiary) / <alpha-value>)',
          400: 'rgb(var(--fg-secondary) / <alpha-value>)',
          300: 'rgb(var(--fg-body) / <alpha-value>)',
          200: 'rgb(var(--fg-primary) / <alpha-value>)',
          100: 'rgb(var(--fg-primary) / <alpha-value>)',
        },
        signal: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          dim: 'rgb(var(--brand-active) / <alpha-value>)',
        },
        mint: { DEFAULT: 'rgb(var(--teal) / <alpha-value>)', dim: 'rgb(var(--teal) / <alpha-value>)' },
        amber: { DEFAULT: 'rgb(var(--warning) / <alpha-value>)', dim: 'rgb(var(--warning) / <alpha-value>)' },
        rose: { DEFAULT: 'rgb(var(--danger) / <alpha-value>)', dim: 'rgb(var(--danger) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],                 // 12/16
        micro: ['0.6875rem', { lineHeight: '0.875rem' }],           // 11/14，仅拉丁戳记
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],                // 13/20
        sm: ['0.875rem', { lineHeight: '1.375rem' }],                // 14/22
        base: ['0.9375rem', { lineHeight: '1.5rem' }],               // 15/24
        lg: ['1rem', { lineHeight: '1.625rem' }],                    // 16/26
        xl: ['1.125rem', { lineHeight: '1.625rem' }],                // 18/26
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.025em' }],
        display: ['3.5rem', { lineHeight: '3.625rem', letterSpacing: '-0.03em' }],
        'readout-sm': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        'readout-md': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
        readout: ['2.75rem', { lineHeight: '2.875rem', letterSpacing: '-0.02em' }],
      },
      letterSpacing: {
        display: '-0.02em',
        tightest: '-0.03em',
        title: '-0.01em',
        label: '0.04em',
        index: '0.08em',
        stamp: '0.12em',
      },
      maxWidth: { shell: '1400px', prose: '760px' },
      borderRadius: {
        chip: '2px',
        control: '4px',
        panel: '6px',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        raise: 'var(--shadow-raise)',
        pop: 'var(--shadow-pop)',
        inset: 'var(--shadow-inset)',
        art: 'var(--shadow-art)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 2.2 类名对照

| 用途 | 首选类名 | 禁用类名 |
|---|---|---|
| 主按钮 | `bg-brand text-white hover:bg-brand-strong` | `bg-accent`（新代码） |
| 次按钮 | `border-line-control bg-surface text-content-primary` | `border-line-strong` |
| 面板 | `rounded-panel border-line bg-surface shadow-panel` | `rounded-lg`/`rounded-xl` |
| 表单边界 | `border-line-control` | `border-line`/`border-line-strong` |
| 银灰结构 | `bg-metal-100`/`border-metal-200` | 用银灰表示数值 |
| 高风险 | `text-risk-high bg-risk-high-soft border-risk-high-line` | `text-danger`（除系统错误外） |
| 需要关注 | `text-risk-medium ...` | `text-warning`（风险语境） |
| 未见风险 | 纯文字 `text-content-muted` | 彩色 chip |
| 数据条形 | `bg-series-bar` | `bg-accent` |
| 人气/维护 | `text-series-popularity` / `text-series-maintenance` | `text-accent` / `text-teal`（新代码） |

### 2.3 兼容策略

- `accent` 继续存在但**只代表品牌动作**，不再代表数据。
- `teal` 映射到维护系列；`signal`→品牌；`mint`→维护；`amber`→警告；`rose`→危险。
- `ink.*` 兼容映射保留，避免一次性大改；新代码一律使用 `canvas/surface/metal/line/content`。
- 修改 `borderRadius.panel` 8→6 会让全站收紧；这是本轮预期变化。

---

## 3. 排版系统

### 3.1 字体栈（不引入外网字体）

```css
/* sans */
-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei",
"PingFang SC", "Noto Sans SC", sans-serif;

/* mono */
ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
```

- 中文正文、表格、说明：sans。
- 数字戳记、坐标轴、编号、代码、长 ID：mono。
- 不请求 Google Fonts / 任何 CDN 字体；不新增 `@font-face`。
- Windows 优先微软雅黑，macOS 优先苹方；两者字宽不同，布局用 `min-w-0` 与换行规则兜底，不写死文字宽度。

### 3.2 字号 / 字距 / 行高

| 角色 | 类名 | 390 | 768 | 1440 | 字重 | 字距 | 行高 |
|---|---|---|---:|---:|---:|---|---|
| 首屏 H1 | `text-4xl md:text-5xl xl:text-display` | 36/40 | 48/52 | 56/58 | 600 | -0.02→-0.03em | 1.11 / 1.08 / 1.04 |
| 子页 H1 | `text-4xl md:text-5xl` | 36/40 | 48/52 | 48/52 | 600 | -0.02em | 1.11 |
| 区块 H2 | `text-2xl lg:text-3xl` | 24/32 | 24/32 | 28/36 | 600 | -0.01 / -0.015em | 1.33 / 1.29 |
| 面板 H3 | `text-xl tracking-title` | 18/26 | 18/26 | 18/26 | 600 | -0.01em | 1.44 |
| 正文 | `text-base` | 15/24 | 15/24 | 15/24 | 400 | 0 | 1.60 |
| 次正文 | `text-sm` | 14/22 | 14/22 | 14/22 | 400 | 0 | 1.57 |
| 辅助 | `text-xs` | 13/20 | 13/20 | 13/20 | 400 | 0 | 1.54 |
| 中文微标签 | `text-2xs` | 12/16 | 12/16 | 12/16 | 500 | 0.01em | 1.33 |
| 拉丁戳记 | `text-micro font-mono uppercase tracking-stamp` | 11/14 | 11/14 | 11/14 | 600 | 0.12em | 1.27 |
| 编号/索引 | `text-micro font-mono tracking-index` | 11/14 | 11/14 | 11/14 | 500 | 0.08em | 1.27 |
| 大读数 | `text-readout-sm md:text-readout-md xl:text-readout` | 36/40 | 40/44 | 44/46 | 600 | -0.02em | 1 |
| 数据单元格 | `font-mono text-xs tnum` | 13/20 | 13/20 | 13/20 | 500 | 0 | 1.54 |
| 按钮 | `text-sm leading-5` | 14/20 | 14/20 | 14/20 | 500 | 0 | 1.43 |

> 中文 12px 已是下限；11px 只允许拉丁字母/数字，不允许中文长句。
> 中文标题负字距不超过 -0.02em，避免笔画挤压；56px 首屏可用 -0.03em。

### 3.3 数字规则

- 所有数值：`font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;`（现有 `.tnum` 保留）。
- 大读数用 sans + tabular，不用 mono；小数据、时间戳、坐标轴用 mono。
- 数字与单位分离：数字 36–44px，单位 13px/`fg-tertiary`，间距 4px，不缩小数字。
- 千分位、百分比、`+/-`、`/100` 后缀必须来自格式化函数，不手工拼接。
- 空值统一 `—`，缺失说明用文字，不用 0 代替。
- 不在数字上使用点阵纹理、斜体或负字距以外的变形。

### 3.4 中文阅读规则

- 正文行宽 34–46 个汉字（`max-w-2xl` 约 672px）；长文用 `max-w-prose`。
- 段落 `line-height` 1.60–1.67（15/24–15/25），不低于 1.6；方法页长文可用 `leading-7`。
- 标题 `text-wrap: balance`；正文 `text-wrap: pretty`（渐进增强，不支持时无影响）。
- 不`uppercase`中文；不对中文使用 `tracking-widest`。
- 长英文仓库名/安装命令：`break-all` 仅用于代码/仓库列；中文卡片用 `break-words`。
- 所有 `flex` 文本子项加 `min-w-0`，表格用 `table-fixed`，防止长名撑破。

### 3.5 点阵英文标题 / 编号（轻量实现）

#### 目标与边界

- 只用于**短英文标题、模块编号、装饰标签**；不用于中文、正文、表格、按钮、数据值。
- 不依赖外网字体、不新增字体文件、不引入 3D/Canvas 库。
- 技术：`radial-gradient` 点阵 + `background-clip: text`，点距用 `em` 随字号缩放。
- **诚实说明**：这是“半调点阵填充”，不是严格的 5×7 LED 字形。BRIEF 允许 CSS 点阵纹理/系统等宽组合；若未来必须严格点阵，需自托管子集字体，不在本轮范围。

#### CSS

```css
/* 排版部分始终生效，颜色填充只在支持时启用，因此天然降级 */
.dot-matrix {
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1;
  word-break: keep-all;
}

@supports ((background-clip: text) or (-webkit-background-clip: text)) {
  .dot-matrix {
    color: transparent;
    -webkit-text-fill-color: transparent;
    background-color: transparent;
    background-image: radial-gradient(
      circle at center,
      rgb(var(--fg-primary) / 0.92) 0.02em,
      transparent calc(0.02em + 0.008em)
    );
    background-size: max(2.6px, 0.075em) max(2.6px, 0.075em);
    background-position: 0 0;
    background-repeat: repeat;
    -webkit-background-clip: text;
    background-clip: text;
  }

  .dot-matrix--brand {
    background-image: radial-gradient(
      circle at center,
      rgb(var(--brand)) 0.02em,
      transparent calc(0.02em + 0.008em)
    );
  }

  /* 透明文字被选中时必须恢复可读 */
  .dot-matrix::selection {
    color: rgb(var(--fg-primary));
    -webkit-text-fill-color: rgb(var(--fg-primary));
    background: rgb(var(--selection));
  }
}

/* 强制高对比 / Windows 高对比 / 打印：回到实心墨色 */
@media (prefers-contrast: more), (forced-colors: active), print {
  .dot-matrix,
  .dot-matrix--brand {
    background-image: none;
    color: rgb(var(--fg-primary));
    -webkit-text-fill-color: currentColor;
  }
}
```

#### 使用规则

| 规则 | 值 |
|---|---|
| 最小字号 | 32px；推荐 36–56px |
| 字符 | 仅 A–Z、0–9、`/`、`·`；≤ 24 字符 |
| 每屏数量 | 最多 1 个点阵标题 + 2 个点阵编号 |
| 行数 | 最多 2 行，`line-height: 1`，行间留 8px |
| 字重 | 700；不要合成粗体（避免 `font-synthesis`） |
| 背景 | 必须纯色 canvas/surface；不做底图叠加 |
| 交互 | 不可点、不可聚焦；装饰性重复文本加 `aria-hidden="true"` |

#### 降级链

1. 浏览器支持 `background-clip:text` → 点阵填充。
2. 不支持 → `color` 未被设为透明，自动显示实心墨色（因为透明只在 `@supports` 内）。
3. `prefers-contrast: more` / `forced-colors` / 打印 → 实心墨色。
4. 字体缺失 → 回退系统 mono/sans，字宽变化由 `min-h` 与允许换行兜底，不锁死宽度。
5. 文本缩放 200% → 点距是 `em`，随字号等比缩放，不出现稀疏/糊版。

#### 示例

```html
<p class="stamp mb-3">FIG.01 / ECOSYSTEM</p>
<h1 class="dot-matrix text-5xl xl:text-display">PLUGIN HEALTH</h1>
<p class="stamp mt-2 text-content-muted">装饰性标题 · 不表示数据</p>
```

编号在 11px 时**不使用**点阵纹理，改用 `.stamp` 等宽大写；保证小字号可读。

---

## 4. 空间、边框、刻度、圆角、阴影

### 4.1 间距（4px 基准）

| Token | 值 | 典型用途 |
|---|---:|---|
| `1` | 4px | 图标与文字、数字与单位 |
| `2` | 8px | 按钮内图标、chip 间距、标签组 |
| `3` | 12px | 控件内边距、表格单元格 |
| `4` | 16px | 面板内边距（移动）、卡片间距 |
| `5` | 20px | 面板内边距（平板）、区块内间距 |
| `6` | 24px | 面板内边距（桌面）、网格间距 |
| `8` | 32px | 区块间距、桌面网格 |
| `10` | 40px | 区块上间距（移动） |
| `12` | 48px | 区块上间距（平板） |
| `16` | 64px | 区块上间距（桌面） |
| `20` | 80px | 首屏/页脚大留白 |

语义布局令牌（基础值定义在 §1.2；下面只做断点覆盖）：

```css
@media (min-width: 768px) {
  :root { --gutter: 1.5rem; --section-gap: 3.5rem; --panel-pad: 1.25rem; }
}
@media (min-width: 1280px) {
  :root { --gutter: 2rem; --section-gap: 4.5rem; --panel-pad: 1.5rem; }
}
```

不做“整页同尺寸卡片连续堆叠”：至少使用数据带（全宽）、非对称双栏、榜单行、探索表四种不同密度。

### 4.2 边框

| 名称 | Token | 值 | 用途 |
|---|---|---|---|
| 发丝线 | `line-hairline` | 1px `#EAEAE6` | 表格行、面板内分隔 |
| 面板线 | `line` | 1px `#DFDFDA` | 面板外框、分区 |
| 强分隔 | `line-strong` | 1px `#C9C9C4` | 表头下沿、图例上沿 |
| 控件线 | `line-control` | 1px `#8A8A84` | 输入/选择/次按钮边界 |
| 墨线 | `rule-ink` | 1px `#1A1A1A` | 数据带上沿、重点区块上沿（每页 ≤3 处） |
| 品牌线 | `brand` | 2px `#D71920` | 激活导航下划线、主视觉信号条 |
| 焦点线 | `focus` | 2px `#1A1A1A` + 2px offset | 所有可交互元素 |

- 不使用 3px 以上边框；不使用彩色边框（除风险/品牌语义）。
- 虚线只用于：空状态框、未知风险、缺数区域、阈值线、主视觉轨道。其余一律实线。

### 4.3 刻度线

| 类型 | 规格 | 颜色 | 说明 |
|---|---|---|---|
| 装饰标尺（局部） | 1×6px，节距 8px | `line-strong` 70% | 无数字、无单位、`aria-hidden` |
| 主刻度（装饰） | 1×10px，每 40px | `fg-tertiary` 45% | 仅用于首屏/区块边缘 |
| 图表刻度 | 4px 短线 | `chart-axis-line` | 有坐标值，属真实图表 |
| 覆盖度分段 | 2×8px，间隙 2px | 填充 `series-bar`，空槽 `surface-sunken` | 必须配 `x/y 域` 文字 |
| 阈值虚线 | 1px，dash 4/4 | `chart-threshold` | 必须带 `X 50` / `Y 60` 标签 |

```css
.tick-ruler {
  height: 6px;
  background-image: repeating-linear-gradient(
    90deg,
    rgb(var(--line-strong) / 0.7) 0 1px,
    transparent 1px 8px
  );
  pointer-events: none;
}
```

### 4.4 圆角

| Token | 值 | 用途 |
|---|---:|---|
| `rounded-none` | 0 | 表格单元格、数据条内部 |
| `rounded-chip` | 2px | 标签、chip、图例色块 |
| `rounded-control` | 4px | 按钮、输入、选择、分页 |
| `rounded-panel` | 6px | 面板、tooltip、弹层、主视觉模块 |
| `rounded-full` | 999px | 仅状态灯/圆点 |

禁止 `rounded-lg` (8px)、`rounded-xl`、胶囊按钮（除状态灯）。头像/字母块使用 4px，不使用圆形。

### 4.5 阴影

| Token | 值 | 用途 |
|---|---|---|
| `shadow-panel` | `0 1px 2px rgba(26,26,26,.05)` | 面板，几乎平贴 |
| `shadow-raise` | `inset 0 1px 0 rgba(255,255,255,.9), 0 2px 6px rgba(26,26,26,.06)` | 抬起控件/金属片 |
| `shadow-pop` | `0 16px 40px -16px rgba(26,26,26,.22), 0 1px 2px rgba(26,26,26,.06)` | tooltip/弹层 |
| `shadow-inset` | `inset 0 1px 2px rgba(26,26,26,.1)` | 按下态 |
| `shadow-art` | `0 24px 60px -28px rgba(26,26,26,.35)` | 主视觉模块 |

- 不使用彩色阴影、发光阴影、玻璃拟态大模糊（主视觉的 `backdrop-filter` 仅限 CSS 变体）。
- 面板默认没有 hover 抬升；数据行 hover 只改背景，不动画位移。

---

## 5. 主视觉：Silver Module / Signal / Ecology

### 5.1 概念

一个**银色半透明插件模块**悬浮在同心轨道中：
- **模块**：拉丝银灰面板、四角螺钉、点阵窗口、红色信号条。
- **信号**：一段 2px 品牌红圆弧，从模块延伸到外环；静态，不闪烁。
- **生态**：三条同心轨道 + 三个节点，表示插件在生态中的位置；**不带标签、不带数字**，避免被读成真实指标。

视觉重心靠“银灰渐变 + 1px 结构线 + 大面积留白”，用层叠阴影板与玻璃高光制造 **2.5D 厚度**，不做透视投影。禁止引入 three.js/WebGL/大型 3D 依赖。

### 5.2 分层

| 层 | 元素 | 作用 |
|---|---|---|
| 1 | 同心圆轨道、刻度环、细连线 | 生态/仪器 |
| 2 | 半透明白玻璃板（旋转 6°） | 银色半透明的“第二层” |
| 3 | 模块阴影板（下移 20px） | 厚度感，不模拟 3D |
| 4 | 模块本体：银灰渐变 + 玻璃高光 | 插件模块 |
| 5 | 点阵窗口、红色信号条、刻线、螺钉、标签 | 仪器细节 |
| 6 | 2px 红色圆弧 | 信号/品牌 |

### 5.3 内联 SVG（桌面/平板，520×520）

```html
<figure class="hero-art">
  <div class="hero-art__stage">
    <svg viewBox="0 0 520 520" role="presentation" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="art-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FFFFFF"/>
          <stop offset=".28" stop-color="#F3F3F0"/>
          <stop offset=".55" stop-color="#DEDED9"/>
          <stop offset=".78" stop-color="#C9C9C4"/>
          <stop offset="1" stop-color="#ECECE8"/>
        </linearGradient>
        <linearGradient id="art-glass" x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" stop-color="#FFFFFF" stop-opacity=".92"/>
          <stop offset=".45" stop-color="#FFFFFF" stop-opacity=".28"/>
          <stop offset="1" stop-color="#FFFFFF" stop-opacity=".06"/>
        </linearGradient>
        <linearGradient id="art-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/>
          <stop offset="1" stop-color="#8A8A84" stop-opacity=".35"/>
        </linearGradient>
        <pattern id="art-dots" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" fill="#4A4A46" fill-opacity=".38"/>
        </pattern>
        <filter id="art-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#1A1A1A" flood-opacity=".16"/>
        </filter>
      </defs>

      <!-- 1. 生态轨道 -->
      <g fill="none" stroke="#C9C9C4">
        <circle cx="260" cy="260" r="236" stroke-opacity=".45" stroke-dasharray="2 8" vector-effect="non-scaling-stroke"/>
        <circle cx="260" cy="260" r="190" stroke-opacity=".72" vector-effect="non-scaling-stroke"/>
        <circle cx="260" cy="260" r="146" stroke-opacity=".45" stroke-dasharray="1 6" vector-effect="non-scaling-stroke"/>
        <circle cx="260" cy="260" r="222" stroke-opacity=".38" stroke-width="6" stroke-dasharray="1 11"/>
      </g>

      <!-- 2. 半透明玻璃板 -->
      <rect x="188" y="118" width="176" height="112" rx="6"
            fill="rgba(255,255,255,.42)" stroke="rgba(255,255,255,.82)"
            transform="rotate(6 276 174)"/>

      <!-- 生态节点（无标签、无数字） -->
      <g>
        <line x1="375" y1="350" x2="404" y2="372" stroke="#1A1A1A" stroke-opacity=".22"/>
        <line x1="176" y1="141" x2="155" y2="110" stroke="#1A1A1A" stroke-opacity=".22"/>
        <circle cx="82" cy="195" r="5" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="1.5"/>
        <circle cx="82" cy="195" r="1.5" fill="#1A1A1A"/>
        <circle cx="410" cy="377" r="5" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="1.5"/>
        <circle cx="410" cy="377" r="1.5" fill="#1A1A1A"/>
        <circle cx="151" cy="104" r="4" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="1.5"/>
        <circle cx="151" cy="104" r="1.2" fill="#1A1A1A"/>
      </g>

      <!-- 3–5. 银色模块 -->
      <g transform="rotate(-8 260 260)">
        <rect class="art-shadow" x="158" y="196" width="204" height="148" rx="6"
              fill="#C9C9C4" opacity=".5" filter="url(#art-shadow)"/>
        <rect x="158" y="176" width="204" height="148" rx="6"
              fill="url(#art-silver)" stroke="#B0B0AA" vector-effect="non-scaling-stroke"/>
        <rect x="158" y="176" width="204" height="148" rx="6"
              fill="url(#art-glass)" stroke="url(#art-edge)" vector-effect="non-scaling-stroke"/>
        <path d="M170 188H350" stroke="#FFFFFF" stroke-opacity=".9"/>

        <rect x="182" y="200" width="100" height="64" rx="2"
              fill="url(#art-dots)" stroke="#1A1A1A" stroke-opacity=".12"/>
        <rect x="292" y="200" width="6" height="64" fill="#D71920"/>

        <g stroke="#4A4A46" stroke-opacity=".32">
          <path d="M306 206h34"/>
          <path d="M306 218h26"/>
          <path d="M306 230h30"/>
          <path d="M306 242h20"/>
        </g>

        <text x="182" y="300" fill="#4A4A46" fill-opacity=".7"
              font-family="ui-monospace, SFMono-Regular, Consolas, monospace"
              font-size="8.5" letter-spacing="2">DSH / MODULE</text>

        <g fill="#BDBDB7" stroke="#FFFFFF" stroke-opacity=".85">
          <circle cx="170" cy="188" r="2.2"/>
          <circle cx="350" cy="188" r="2.2"/>
          <circle cx="170" cy="312" r="2.2"/>
          <circle cx="350" cy="312" r="2.2"/>
        </g>
      </g>

      <!-- 6. 信号弧 -->
      <path d="M355 96A190 190 0 0 1 447 227"
            fill="none" stroke="#D71920" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </div>
  <figcaption class="stamp mt-3">FIG.01 / SILVER MODULE · 装饰示意，不表示数据</figcaption>
</figure>
```

配套样式：

```css
.hero-art { position: relative; }

.hero-art__stage {
  width: min(100%, 520px);
  aspect-ratio: 1 / 1;
}

.hero-art svg { display: block; width: 100%; height: auto; overflow: visible; }

@media (max-width: 767px) {
  .art-shadow { filter: none; } /* 移动端关闭 SVG 阴影滤镜 */
}
```

> 插画主色与令牌对应：银灰 `#E4E4E0`/`#C9C9C4`/`#B0B0AA`，墨色 `#1A1A1A`/`#4A4A46`，品牌红 `#D71920`，结构线 `#EAEAE6`；渐变中间色与螺钉高光为插画专用。令牌调整时必须同步此 SVG；品牌红仅出现在信号条/信号弧，不得扩展为数据编码。

### 5.4 纯 CSS 紧凑版（<768，96–112px）

```html
<span class="module-mark" aria-hidden="true">
  <span class="module-mark__rail"></span>
  <span class="module-mark__label">DSH</span>
</span>
```

```css
.module-mark {
  --mark-size: 112px;
  position: relative;
  display: block;
  inline-size: var(--mark-size);
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgb(var(--metal-300));
  border-radius: var(--radius-panel, 6px);
  background:
    linear-gradient(150deg, #FFFFFF 0%, #F3F3F0 32%, #DEDED9 58%, #C9C9C4 78%, #ECECE8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .95),
    inset 0 -1px 0 rgba(26, 26, 26, .14),
    0 12px 28px -18px rgba(26, 26, 26, .35);
}

/* 玻璃层 */
.module-mark::before {
  content: "";
  position: absolute;
  inset: 9% 8% 54% 10%;
  border: 1px solid rgba(255, 255, 255, .8);
  background: linear-gradient(160deg, rgba(255, 255, 255, .8), rgba(255, 255, 255, .12));
  transform: rotate(-5deg);
  pointer-events: none;
}

/* 点阵窗口 */
.module-mark::after {
  content: "";
  position: absolute;
  inset: 20% 46% 32% 16%;
  border: 1px solid rgb(var(--fg-primary) / .12);
  background-image: radial-gradient(rgb(var(--fg-body) / .38) 1px, transparent 1.1px);
  background-size: 5px 5px;
  pointer-events: none;
}

.module-mark__rail {
  position: absolute;
  top: 20%;
  bottom: 32%;
  right: 20%;
  width: 4px;
  background: rgb(var(--brand));
}

.module-mark__label {
  position: absolute;
  left: 16%;
  bottom: 13%;
  font: 700 7px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .16em;
  color: rgb(var(--fg-body) / .6);
}

@media (max-width: 639px) {
  .module-mark { --mark-size: 96px; }
}
```

### 5.5 响应式与放置

| 宽度 | 形式 | 尺寸 | 规则 |
|---|---|---:|---|
| 390 | CSS `module-mark` | 96px | 可放在标题上方/首屏右侧，不遮文字；不显示轨道 |
| 768 | SVG 全图 | 280–320px | 单列置于文案下方或右侧；关闭阴影滤镜 |
| 1440 | SVG 全图 | 480–520px | 双栏首屏右侧，允许出血裁切 8–12% |

- 插画可在容器内裁切，但**不得覆盖正文、按钮、图表**。
- 装饰层 `pointer-events: none`；SVG `aria-hidden="true"`。
- 不添加持续闪烁/扫描动画；如需入场，仅 400ms 透明度+8px 位移，`prefers-reduced-motion` 下取消。
- 图注必须可见：“装饰示意，不表示数据”。

### 5.6 性能

- 内联 SVG ≤ 8KB；无位图、无外链、无字体请求。
- 仅 1 个 `feDropShadow`，<768 用 CSS 覆盖为 `filter:none`。
- 无 `will-change`、无持续动画、无 `backdrop-filter`（CSS 紧凑版用渐变模拟玻璃）。
- 不随滚动重新渲染；纯静态 DOM。

---

## 6. 组件规范

> 所有组件只使用语义 token；状态必须覆盖 default / hover / active / focus-visible / disabled / loading（如适用）。

### 6.1 按钮

| 变体 | Default | Hover | Active | Disabled | 用途 |
|---|---|---|---|---|---|
| Primary | `bg-brand text-white` | `bg-brand-strong` | `bg-brand-active` + 1px 下沉 | 45% 透明 | 每屏 1 个主操作 |
| Secondary | `border-line-control bg-surface text-content-primary` | `border-content-primary bg-surface-subtle` | `bg-surface-sunken` | 45% | 次级操作/筛选清除 |
| Ghost | 透明 `text-content-secondary` | `bg-surface-subtle text-content-primary` | `bg-surface-sunken` | 45% | 链接式操作 |
| Link | `text-content-secondary` + 1px 下划线 `metal-200` | `text-brand-text` + 下划线 `brand` | — | 45% | 文档/方法入口 |

```tsx
const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-colors focus-visible:outline-none disabled:cursor-not-allowed ' +
  'disabled:opacity-45 h-10 px-4 text-sm max-sm:h-11';

const primary = 'bg-brand text-white hover:bg-brand-strong active:bg-brand-active';
const secondary =
  'border border-line-control bg-surface text-content-primary ' +
  'hover:border-content-primary hover:bg-surface-subtle active:bg-surface-sunken';
const ghost = 'text-content-secondary hover:bg-surface-subtle hover:text-content-primary';
```

尺寸：
- `sm`：32px 高，仅桌面，不用于触屏。
- `md`：40px 高（默认）。
- `lg`：44px 高（首屏主 CTA）。
- 移动端所有按钮 `min-height: 44px`；图标按钮 40×40（移动 44×44）。
- 内边距 12/16/20，图标 14–16，图标与文字间距 8。
- 圆角 4px；不使用胶囊。
- 焦点：全局 2px 墨色 outline + 2px offset；移除组件内 `ring-accent`，避免双环。
- 一个视口最多 1 个实心品牌红按钮；主/次按钮并排时主按钮在左（中文阅读顺序）。

### 6.2 输入框 / 搜索

- 高度 44（搜索）/ 40（普通输入），移动端 ≥44。
- 边框 1px `line-control`；背景 `surface`；圆角 4px。
- 文字 15px `fg-primary`；placeholder 15px `fg-tertiary`（5.6:1）。
- 左侧图标 16px，距左 12；输入文字距左 40（有图标）/12（无图标）。
- hover：边框 `fg-secondary`；focus：边框 `fg-primary` + 全局 outline；不使用蓝色光环。
- 清除按钮 36×36（移动 44），仅在有内容时出现，`aria-label="清除搜索"`。
- 搜索框 `type="search"`，`aria-label` 或可见 `<label>`；结果数用 `aria-live="polite"`。
- 错误态：1px `risk-high` 边框 + 下方 13px 错误文案 + 图标；不要仅靠红色边框。

### 6.3 选择器 / 筛选器

- `.select-field`：40px 高（移动 44），1px `line-control`，白底，4px 圆角，13–14px 文字，右侧 12px chevron。
- 原生 `<select>` 保留，保证键盘/读屏；不要用 div 自绘下拉替代。
- 激活的筛选条件（非风险语义）：
  `bg-brand-soft border-brand-line text-brand-text`，前置于结果摘要；显示数量，如“已筛选 6 / 20”。
- 风险筛选的**控件本身**仍用品牌红表示“已选中”；风险语义交给结果里的风险标签，避免品牌红被误读为高风险。
- 移动端：筛选器两列网格（`grid-cols-2 gap-2`），每个 ≥44 高；“更多筛选”按钮 44 高，展开区用 1px 上边框分隔。
- 清除全部：Ghost/Secondary，显示清除项数；`aria-label` 包含数量。
- 结果数变化通过 `aria-live` 播报；不自动滚动。

### 6.4 标签 / Chip

| 类型 | 规格 | 颜色 | 说明 |
|---|---|---|---|
| 分类 | 20px 高，2px 圆角，12px，1px `line`，`surface-subtle` | 4px **方形**墨点 + `fg-secondary` | 分类不是风险，不用品牌红 |
| 置信度 | 20px，同上 | `fg-secondary` | 文字“高/中/低置信” |
| 数据状态 | 20px | 琥珀/中性 | “历史快照/部分数据” |
| 风险-高 | 22px，2px 左条 | `risk-high` 文字/图标，`risk-high-soft` 底 | 盾牌图标 + “高风险信号” |
| 风险-中 | 22px，1px 左条 | `risk-medium` | 三角图标 + “需要关注” |
| 风险-低 | 纯文字，无 chip | `fg-tertiary` | “未见公开风险”，避免绿色暗示安全 |
| 风险-未知 | 22px，**虚线**边框 | `risk-unknown` | 问号图标 + “信息不完整” |

- Chip 内边距 2×6，图标 12，文字 12/16，圆角 2px。
- 风险 chip 的 2px 左条是强制非颜色线索；低风险不给彩色 chip，避免“绿色=安全”的误读。
- 不使用品牌红分类点/分类 chip；分类点必须是方形，与圆形状态灯区分。

### 6.5 面板 / 数据带

```css
.panel {
  @apply relative rounded-panel border border-line bg-surface shadow-panel;
}
.panel--ink-top { border-top-color: rgb(var(--fg-primary)); }
.panel--quiet { @apply rounded-panel border border-line bg-transparent; }

.panel-head {
  @apply flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5 md:py-4;
}
.panel-foot {
  @apply flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 md:px-5;
}

.data-band {
  @apply border-b border-line bg-surface;
  border-top: 1px solid rgb(var(--fg-primary));
}
```

- 面板内边距 16/20/24；标题 18–24px；说明 13–14px。
- 面板头高度 56–64；底部元信息 40–48；不要“标题 + 大空白 + 小内容”。
- 数据带：上沿 1px 墨线，白底，统计单元用发丝线分隔；统计数字 36–44px。
- 面板不嵌套面板；用发丝线/留白分组。
- 可选 `.panel--instrument` 在左上/右下加 10px L 形银灰角标（纯装饰，`::before/::after`，`pointer-events:none`），每页最多 2 处。

### 6.6 表格

```css
.data-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.data-table thead { background: rgb(var(--surface-subtle)); }
.data-table th {
  height: 40px;
  padding: 8px 12px;
  border-bottom: 1px solid rgb(var(--line-strong));
  color: rgb(var(--fg-tertiary));
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}
.data-table td {
  height: 56px; /* 两行内容时由内容撑到 ~64，不裁切 */
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--line-hairline));
  vertical-align: middle;
}
.data-table tbody tr:hover { background: rgb(var(--surface-subtle)); }
.data-table tbody tr:focus-within {
  background: rgb(var(--surface-subtle));
  box-shadow: inset 2px 0 0 rgb(var(--fg-primary));
}
.data-table .num {
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
```

- 表头 12px，中文不用大写；排序按钮激活时 `text-content-primary`，箭头可见；`aria-sort` 保留。
- 行高 56（两行内容 64）/64（平板）/卡片 64+（移动）。
- 无斑马纹；hover 只变背景；选中行用 2px 墨色左条，不用品牌红（避免与风险混淆）。
- 数字右对齐、等宽；名称列左对齐；长名 `truncate` + `title`，仓库名可 `break-all`。
- 移动端 <1024 改卡片列表；每张卡一个主指标 + 最多 3 个辅助读数。
- 可访问性：真实 `<table>`、`th scope`、`caption`/`sr-only` 标题、行内链接有可读名称；不要整行仅靠点击 div。

### 6.7 状态灯

```css
.status-light {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(var(--fg-primary) / 0.12);
  flex: none;
}
```

| 状态 | 颜色 | 辅助 |
|---|---|---|
| 正常 | `success` #1C6444 | 文字“正常/已更新” |
| 部分/过期 | `warning` #7C5208 | 文字“可能已过期”，不闪烁 |
| 失败 | `danger` #9E2E12 | 文字“更新失败” |
| 空闲/加载 | `fg-tertiary` + `animate-pulse` | 文字“加载中”；`reduce-motion` 下停止脉冲 |
| 无数据 | `fg-disabled` | 文字“暂无数据” |

- 状态灯**必须**与文字标签同时出现；不允许只有颜色点。
- 灯径 8px；外环 1px 墨色 12%；不加外发光。
- 装饰性 LED 只允许出现在主视觉插画中，且静态；不模仿状态灯颜色（不用 success/warning）。

### 6.8 编号

| 类型 | 样式 | 规则 |
|---|---|---|
| 章节编号（装饰） | `.stamp` 11px mono，`01 / 06` | 静态、`aria-hidden`，不随数据变化 |
| 榜单名次（真实） | `.index` 11–12px mono，tabular | 与行绑定，提供 `aria-label="第 1 名"`；不用品牌红 |
| 表格行号（位置） | 11px mono，`fg-tertiary` | 分页时连续编号；不是指标 |
| 读数（真实） | `.readout` sans 600，36–44px | 数字 + 单位分离；无点阵纹理 |
| 图表轴刻度（真实） | mono 11px | 必须有坐标含义 |

- 点阵纹理只用于 ≥32px 的装饰性英文标题/模块编号；**任何真实数据数字禁止点阵**。
- 名次 01–03 用字重 600 + 墨色，不用红色，避免与风险/品牌混淆。
- 章节编号/索引使用 `text-content-muted`，不用品牌红；现有 `text-accent` 的编号改为中性色。

### 6.9 时间戳

- 绝对时间：`YYYY-MM-DD HH:mm`，Asia/Shanghai，24 小时制；前缀“更新于 / 采集于”。
- 等宽 11–12px，`tabular-nums`；`<time dateTime={iso}>`，`title` 放完整 ISO。
- 相对时间：13px sans（“2 小时前”），`title` 放绝对时间。
- 时区在区块内标注一次“UTC+8”，不重复。
- 过期：琥珀灯 + 文字“可能已过期”；超过 24h 用“数据过期”；不要只变颜色。
- 装饰插画中没有时间戳；图注中的 `FIG.01` 不是时间。

### 6.10 空状态

- 结构：48px 虚线方框（1px `line-strong`，2px 圆角）+ 20px 线性图标 + 标题 15/22 600 + 说明 13/20 `fg-secondary` + 次级按钮。
- 不使用品牌红；不使用插画大图。
- 必须显示**真实计数**（如“0 / 20 匹配”），不要写死 0 或假装有数据。
- 给出可执行动作：“清除全部筛选”“修改搜索词”。
- 空状态与错误状态区分：空状态中性灰；错误状态锈红 + 图标 + 重试。

### 6.11 Tooltip / 说明气泡

- 触发：`InfoHint` 28×28 视觉尺寸，`after:-inset-2` 扩大到 44×44 命中区；点击/聚焦打开，Escape 关闭，失焦关闭。
- 面板：白底、1px `line-strong`、6px 圆角、`shadow-pop`、内边距 10×12、最大宽 280–300、13/20 文字 `fg-secondary`。
- 标题 13/18 600 `fg-primary`；正文 13/20；底部元信息 11/16 `fg-tertiary`，上方 1px 发丝线。
- 对比度：正文 6.9:1，辅助 5.6:1，标题 17.4:1。
- 不要放在 `overflow-hidden` 面板内导致裁切；必要时用 portal/`position: fixed`。
- `role="tooltip"`、`aria-describedby`、`aria-expanded`；触屏首次点按只显示，不跳转。
- 不在 tooltip 内放交互控件或长文；长解释用 `<details>`。

### 6.12 折叠说明 / Disclosure

- 使用原生 `<details>/<summary>`；`summary` 最小高 44，整行可点。
- 移除默认三角：`summary { list-style: none; } summary::-webkit-details-marker { display: none; }`，但仍保留原生键盘行为。
- 左侧 12px 方框“+ / −”（1px `line-control`，内部两条 1px 线；展开时竖线隐藏），或 chevron 旋转 90°；二选一，全站统一。
- 打开时背景 `surface-subtle`；内容 13/22，`fg-secondary`；上沿 1px 发丝线；内边距 12。
- 不做高度动画（避免重排）；只做 120ms 透明度。
- `summary` 文案包含数量与原因，如“3 个插件未进入象限 · 缺少维护评分或核验下载量”。
- 键盘：原生 Space/Enter；焦点可见；不要移除 marker 后丢失可聚焦性。

### 6.13 分页 / 加载 / 错误（补充）

- 分页按钮 40（移动 44），当前页品牌红实心（这是“当前操作”，不是数据）；其余 Secondary；禁用 35% 透明 + `aria-disabled`。
- 页码信息 12px 等宽：“第 1 / 2 页 · 共 20 个结果”。
- 加载：骨架用 `surface-sunken` 块 + 1px `line-hairline`，不闪烁；标签“读取本地数据快照”；`role="status"`；spinner 用 `fg-secondary`，不用品牌红。
- 错误：锈红图标 + 标题“数据快照无法加载” + 具体消息 + 重试（Secondary）+ 方法链接；不使用大面积红色背景。

---

## 7. ECharts 浅色主题

### 7.1 原则

1. 图表背景透明，画布颜色由页面提供。
2. 所有 hex 集中在 `chartTheme.ts`，组件不得写色值（保持现有约定）。
3. 轴/网格是结构，不是数据：1px、低对比，但轴线保持 3:1。
4. 气泡/线条/条形是数据：颜色 + 形状/描边 + 文字三重可读。
5. tooltip 是文字界面：必须满足 AA，不使用暗色底。
6. 不用渐变填充大面积数据区；面积填充 ≤8%。

### 7.2 `chartTheme.ts` 目标值

```ts
/**
 * Single source of truth for every colour and font used inside ECharts.
 * Hex values mirror the CSS tokens in docs/design/01-visual-system.md §1.2.
 * Do not add local colour literals in chart components.
 */
export const chartTheme = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace',
  fontSize: 12,
  axisFontSize: 11,

  strong: '#1A1A1A',
  text: '#4A4A46',
  axisText: '#686864',
  grid: '#EAEAE6',
  axisLine: '#8A8A84',
  threshold: '#8A8A84',
  labelBackground: 'rgba(255, 255, 255, 0.96)',
  axisPointerShadow: 'rgba(26, 26, 26, 0.05)',

  /** Neutral band used to mark platform-wide missing days; never a data value. */
  gapArea: 'rgba(150, 150, 144, 0.16)',
  gapSwatch: '#E5E5E0',

  tooltip: {
    background: '#FFFFFF',
    border: '#C9C9C4',
    title: '#1A1A1A',
    body: '#4A4A46',
    muted: '#686864',
    footer: '#686864',
    shadow: '0 16px 40px -16px rgba(26,26,26,.22), 0 1px 2px rgba(26,26,26,.06)',
  },

  risk: {
    low: '#2C5264',
    medium: '#7C5208',
    high: '#9E2E12',
    unknown: '#5A5A55',
  },
  riskFill: {
    low: 'rgba(44, 82, 100, 0.10)',
    medium: 'rgba(124, 82, 8, 0.12)',
    high: 'rgba(158, 46, 18, 0.16)',
    unknown: 'rgba(90, 90, 85, 0.08)',
  },
  riskSoft: {
    low: { bg: '#F0F5F8', text: '#2C5264' },
    medium: { bg: '#FCF5E6', text: '#7C5208' },
    high: { bg: '#FBEEE9', text: '#9E2E12' },
    unknown: { bg: '#F4F4F1', text: '#5A5A55' },
  },

  quadrant: {
    'hot-healthy': 'rgba(47, 94, 88, 0.050)',
    'niche-active': 'rgba(38, 38, 36, 0.025)',
    'hot-watch': 'rgba(138, 138, 132, 0.045)',
    quiet: 'rgba(90, 90, 85, 0.020)',
  },

  series: {
    popularity: '#262624',
    maintenance: '#2F5E58',
    bar: '#41413D',
    barHover: '#1A1A1A',
  },
  area: 'rgba(47, 94, 88, 0.08)',

  /** Selected / pinned point, not a brand action. */
  select: { border: '#1A1A1A', width: 3 },
} as const;

export const riskColor = (level: keyof typeof chartTheme.risk): string => chartTheme.risk[level];
export const riskFill = (level: keyof typeof chartTheme.riskFill): string => chartTheme.riskFill[level];
export const quadrantFill = (key: keyof typeof chartTheme.quadrant): string => chartTheme.quadrant[key];

export function tooltipChrome(): string {
  return `box-shadow:${chartTheme.tooltip.shadow};border-radius:6px;overflow:hidden;`;
}
```

**同步表（必须与 §1.2 一致）**

| `chartTheme` 键 | CSS token | Hex |
|---|---|---|
| `strong` | `--fg-primary` | #1A1A1A |
| `text` | `--fg-body` | #4A4A46 |
| `axisText` | `--fg-tertiary` | #686864 |
| `grid` | `--chart-grid` | #EAEAE6 |
| `axisLine` / `threshold` | `--chart-axis-line` / `--chart-threshold` | #8A8A84 |
| `series.popularity` | `--series-popularity` | #262624 |
| `series.maintenance` / `area` | `--series-maintenance` | #2F5E58 |
| `series.bar` / `barHover` | `--series-bar` / `--series-bar-hover` | #41413D / #1A1A1A |
| `risk.*` | `--risk-*` | 见 §1.2 |
| `gapSwatch` | `--chart-gap` | #E5E5E0 |

> ECharts 不能直接使用 CSS 变量；保留静态 hex 是刻意选择。若担心漂移，可加一条单测：读取 `getComputedStyle(document.documentElement)` 与 `chartTheme` 对比。

### 7.3 四象限散点图

- 轴：X/Y 0–100，间隔 20；X 轴线 `axisLine` #8A8A84，Y 轴线隐藏；tick 4px。
- 轴标签：mono 11px `#686864`；移动端不缩小到 10px。
- 网格：1px 实线 `#EAEAE6`；不要虚线网格。
- 阈值：`markLine` 1px dashed 4/4 `#8A8A84`；**显示标签** `X 50` / `Y 60`（10px mono、白底 96%、2px 圆角），因为它是有含义的标注，不是装饰。
- 象限底色：中性/系列极浅（见 `quadrant`），**不使用风险色**；区域含义由标题、计数和图例文字承担。
- 气泡：填充 `riskFill`，描边 `riskColor` 1.5px；高风险 2.5px。
- 高风险非颜色线索：额外一条 **halo series**（见下），不改变气泡本身的形状；图例中高风险为“圆环 + 外环”。
- 气泡尺寸：`8 + normalized * 14`，8–22px；面积编码 Star 量级，tooltip 中给出真实值。
- 标签：仅人气前 3 显示；11px sans、白底 96%、1px `#C9C9C4`、2px 圆角、`hideOverlap`。
- hover：`scale 1.18`、描边 +0.5px、标签强制显示；不做阴影。
- 选中（如果实现 pin）：`selectedMode: 'single'`，`select.itemStyle.borderColor = '#1A1A1A'`、`borderWidth = 3`、`select.label.show = true`；**选中态用墨色，不用品牌红**。
- 高风险 halo 配置：

```ts
const highRisk = data.filter((d) => d.risk === 'high');

series: [
  {
    type: 'scatter',
    name: '高风险外环',
    silent: true,
    z: 1,
    symbolSize: (value: unknown) => {
      const stars = Array.isArray(value) ? Number(value[2]) : 1;
      return symbolSize(stars) + 10;
    },
    itemStyle: {
      color: 'transparent',
      borderColor: chartTheme.risk.high,
      borderWidth: 1,
      opacity: 0.35,
    },
    emphasis: { disabled: true },
    tooltip: { show: false },
    data: highRisk,
  },
  { /* main scatter, z: 2 */ },
]
```

- 图例（HTML 自定义，不用 ECharts legend）：8px 空心圆，1.5px 风险色；高风险外加 14px 外环 35%；未知用虚线描边；文字 12px `fg-secondary`；计数 mono 12px `fg-primary`。
- 空图/未定位：保留现有说明，不强行把缺失插件放进象限；说明文字 13/20 `fg-secondary`。

### 7.4 趋势图

- 线宽 2px；人气 `#262624`，维护 `#2F5E58`；不添加第二条亮度接近的灰线。
- 数据点：6px，白底填充 + 2px 系列色描边；缺失点 `connectNulls: false`。
- 维护面积：`rgba(47,94,88,0.08)`，仅在线下方，不做渐变光晕。
- Y 轴 0–100，间隔 20；X 轴日期 `MM-DD` 11px mono；`hideOverlap: true`。
- 网格 1px `#EAEAE6`；轴线 `#8A8A84`；tick 4px。
- 图例：顶部左对齐，10×10 `roundRect` 2px 圆角，文字 12px `#4A4A46`，间距 16；失活颜色 `#686864`（5.6:1），并用空心标记表示关闭，不只靠变淡。
- hover：`emphasis.focus: 'series'`；非焦点系列透明度降到 0.55（不要 0.35，避免低于可读对比）。
- tooltip：axis trigger，白色，虚线 axisPointer `#8A8A84` 1px；日期标题 13px 600；数值 mono 12px。
- 历史不足/缺失：继续显示“历史不足”文案，不补造点。

### 7.5 下载柱状图

- 柱：`#41413D`，hover `#1A1A1A`，最大宽 14，顶部圆角 2px，`barCategoryGap: '35%'`。
- 7 日均值线：`#2F5E58` 1.5px，无数据点。
- 缺数日：`gapArea` 灰色区域，不画 0 柱；tooltip 写“数据缺失 / 平台缺数日，不按 0 计入均值”；图下必须有灰块图例。
- Y 轴 `formatCompact`，11px mono；X 轴 `MM-DD`，间隔 4/2。
- tooltip 与趋势图一致；不把缺数柱画成 0 高度黑色柱。

### 7.6 Tooltip 对比度（白底）

| 内容 | 颜色 | 对比度 |
|---|---|---:|
| 标题 | #1A1A1A | 17.40 |
| 正文/数值 | #4A4A46 | 8.90 |
| 辅助/时间 | #686864 | 5.60 |
| 高风险 chip | #9E2E12 / #FBEEE9 | 6.49 |
| 中风险 chip | #7C5208 / #FCF5E6 | 6.31 |
| 低风险 chip | #2C5264 / #F0F5F8 | 7.65 |
| 未知 chip | #5A5A55 / #F4F4F1 | 6.29 |

- tooltip 背景纯白（不要半透明），边框 1px `#C9C9C4`，6px 圆角，`shadow-pop`。边框只用于收边，不承担 3:1 边界职责（白底 + 阴影 + 内容已足够识别）；若审计严格要求，改用 `#8A8A84`。
- 内边距 0 + 内部分区：头部 12×14、主体 8×14、底部 8×14；行高 18。
- 最大宽 300；`confine: true`；移动端 `max-width: calc(100vw - 24px)`。
- 不使用暗色 tooltip、不使用彩色底 tooltip（风险 chip 除外）。

### 7.7 图例与选中态

- 图例是解释性 UI，不是数据：12px、`fg-secondary`、8–10px 色块。
- 高风险图例必须包含非颜色线索（外环/虚线/文字）。
- 当前选中/固定项：墨色 3px 描边 + 标签常显；表格中对应行 2px 墨色左条 + `surface-subtle` 背景。
- 分页当前页/主按钮才使用品牌红；**选中的数据项不用品牌红**。

### 7.8 可访问性

- 保留 `aria.enabled: true` 与 `aria.label.description`。
- 四象限保留 `sr-only` 数据表替代视图。
- 图表容器 `role="img"` + `aria-label`；不要在 canvas 上叠加不可读的 `title`。
- 颜色不是唯一编码：风险有图例文字 + halo；阈值有标签；缺数有图例。
- 触屏：第一次点按显示 tooltip，第二次进入详情（保留现有行为）；说明文字可见。

---

## 8. 品牌红 vs 风险红

### 8.1 分工表

| 角色 | Token | Hex | 形制 | 允许位置 |
|---|---|---|---|---|
| 主操作 | `brand` | #D71920 | 实心矩形 + 白字 | 每屏 1 个 |
| 当前导航 | `brand` | #D71920 | 2px 下划线 | 每屏 1 条 |
| 当前项/品牌刻度 | `brand` | #D71920 | 2px 左条/刻度 | 每屏 ≤2 处，不编码数值 |
| 品牌标识 | `brand` | #D71920 | 图标/4px 信号条 | 页头/页脚 |
| 高风险 | `risk-high` | #9E2E12 | 浅底 chip + 盾牌 + 2px 左条 | 数据区 |
| 高风险气泡 | `risk-high` | #9E2E12 | 1.5–2.5px 描边 + 外环 | 图表绘图区 |
| 系统错误 | `danger` | #9E2E12 | 浅底 + 图标 + 文案 | 错误状态 |
| 需要关注 | `risk-medium` | #7C5208 | 浅底 chip + 三角图标 | 数据区 |
| 未见风险 | `fg-tertiary` | #686864 | 纯文字 | 数据区 |

### 8.2 七条规则

1. **语义隔离**：品牌红 = 动作/当前项/品牌身份；风险色 = 数据/状态。任何图表序列、分类点、评分条、排行名次都不得使用品牌红。
2. **形制隔离**：品牌红可以大面积实心；风险红只做描边、2px 左条、小 chip、气泡描边，**不做大面积实心**（≤22px 高）。
3. **相邻隔离**：品牌红实心按钮与风险 chip 不得同高、同形、相邻 <16px；至少换容器或拉开 16px。
4. **文字强制**：风险等级必须同时有图标 + 中文标签；品牌红按钮必须有文字（图标按钮需 `aria-label`）。
5. **图表隔离**：绘图区内不出现品牌红；选中态用墨色；阈值线用中性深灰。
6. **灰阶测试**：截图转灰度后，品牌主按钮仍是“深色实心块 + 白字”，高风险仍是“浅底描边 chip + 图标 + 左条”；若两者难分，说明形制不够，必须改形制而不是改颜色。
7. **色觉测试**：在 deuteranopia/protanopia 模拟下检查；红色会趋近棕黄，必须依赖图标/文字/填充方式区分。

### 8.3 为什么不用“更红”的风险色

- 品牌红 `#D71920` 与高风险 `#9E2E12` 的 CIE76 ΔE 约 25.6，但两者都属红褐色；亮度差 1.42:1，**不足以单独承担区分**。
- 因此区分必须由“填充方式 + 形状 + 图标 + 文字”承担；颜色只是辅助。
- 高风险刻意选择更低明度、偏锈的 `#9E2E12`，与品牌红的亮红形成“金属锈 vs 信号红”的材质差异。

### 8.4 禁止清单

- ❌ 用 `bg-accent` 表示高风险、热门、分类、排名。
- ❌ 用品牌红画图表折线/柱/气泡。
- ❌ 用风险锈红做主按钮/链接 hover。
- ❌ 只用一个红点表示风险，没有文字。
- ❌ 在品牌红按钮旁 8px 内放同尺寸高风险 chip。
- ❌ 用绿色 chip 表示“未见风险”（会暗示安全认证）。

---

## 9. 装饰元素 vs 真实指标

### 9.1 判定流程

对任何一个元素问三个问题：

1. **快照变化时它会变吗？** 会 → 数据；不会 → 装饰。
2. **它有单位、百分比、时间或来源吗？** 有 → 数据，必须给出口径/时间戳。
3. **它可以交互/聚焦/有 tooltip 吗？** 可以 → UI 控件；装饰必须 `aria-hidden` 且 `pointer-events:none`。

### 9.2 清单

| 元素 | 分类 | 规则 |
|---|---|---|
| 首屏轨道、点阵窗口、玻璃板、螺钉 | 装饰 | 无数字/单位；`aria-hidden`；图注“不表示数据” |
| 红色信号弧/信号条 | 装饰（品牌） | 静态；不闪烁；不模仿状态灯 |
| 章节编号 `01 / 06` | 装饰 | 静态；带 `SEC.`/`FIG.` 前缀；`aria-hidden` |
| 表格行号 | 位置（真实） | 与分页数据一致；不是指标 |
| 榜单名次 | 真实 | 有 `aria-label`；不用红色 |
| 标尺刻度 | 装饰 | 无数字；≤6% 对比；不跨文字 |
| 图表坐标轴/网格 | 数据支撑 | 有坐标值；轴线 3:1；网格 1px |
| 阈值虚线 | 真实标注 | 必须显示 `X 50`/`Y 60` |
| 象限底色 | 组织性装饰 | 不表示风险/数值；不配“高/低”颜色图例 |
| 状态灯 | 真实状态 | 必配文字；加载才脉冲 |
| 时间戳 | 真实 | `<time>` + 时区；过期有文字 |
| 覆盖度分段 | 真实 | 配 `x/y 域` 文字；空槽不是 0 |
| 骨架块 | 非数据 | 银灰；`aria-hidden`；不显示假数字 |
| 筛选计数 badge | 真实 | 由当前结果计算；不写死 |
| `FIG.01` | 装饰 | 不随时间变化；不是版本号 |

### 9.3 视觉编码

| 类别 | 颜色 | 形态 | 对比 |
|---|---|---|---|
| 真实数据 | 墨色/系列色/风险色 | 实线、实心、有标签 | 文字 ≥4.5:1 |
| 结构 | 银灰 `metal-200`、`line-*` | 1px 线、角标 | 不承载数值 |
| 装饰 | 银灰 30–60%、点阵 | 虚线、细线、纹理 | ≤6%，不与文字竞争 |

### 9.4 文案标注

- 主视觉图注：**“FIG.01 / SILVER MODULE · 装饰示意，不表示数据”**。
- 阈值：**“X=50 / Y=60 · 相对阈值，用于组织视图，不是及格线”**（保留现有说明）。
- 象限底色：不添加图例；标题写“人气 × 维护健康度”，不写“风险区域”。
- 缺数：**“灰色区域为平台缺数日，不按 0 计入均值”**。
- 装饰编号：**“SEC.01 / INDEX”**，不写“第 1 名”。

---

## 10. 响应式：390 / 768 / 1440

### 10.1 三档总表

| Token / 元素 | 390 | 768 | 1440 |
|---|---|---|---|
| 页面左右留白 | 16 | 24 | 32 |
| 最大内容宽 | 100% | 100% | 1400 |
| 首屏 H1 | 36/40 | 48/52 | 56/58 |
| 区块 H2 | 24/32 | 24/32 | 28/36 |
| 正文 | 15/24 | 15/24 | 15/24 |
| 辅助 | 13/20 | 13/20 | 13/20 |
| 大读数 | 36/40 | 40/44 | 44/46 |
| 面板内边距 | 16 | 20 | 24 |
| 区块间距 | 40 | 56 | 72 |
| 网格间距 | 16 | 24 | 32 |
| 表格行高 | 卡片 64+ | 卡片 64+ | 56（两行 64） |
| 按钮高度 | 44 | 40 | 40 |
| 图表高度（首页象限） | 280 | 360 | 420 |
| 图表高度（四象限页） | 420 | 480 | 540 |
| 趋势/下载图 | 220 | 260 | 280 |
| 主视觉 | CSS 96px | SVG 280–320 | SVG 480–520 |
| 统计列数 | 2 | 3 | 5 |
| 插件列表 | 卡片 | 卡片 | 表格（≥1024） |
| 筛选器 | 2 列网格 | 3–4 个换行 | 单行 |
| 点阵标题 | 仅 1 个，≥32px | 1 个，≥36px | 1 个，40–56px |

### 10.2 390

- 单列；推荐顺序（最终以 `02-ux-layout.md` 为准）：标题 → 说明 → 主 CTA → 元信息 → 象限图；主视觉缩为 96px 标记，放在标题上方或右上，不挤占首屏高度。
- 所有可点区域 ≥44×44；按钮/筛选器/分页全部 44 高。
- 统计 2 列；第 5 项跨 2 列（保留现有 `col-span-2` 逻辑）。
- 插件探索：卡片列表；名称 `break-words`；仓库名 `truncate` + title；筛选器两列，搜索框整行。
- 表格隐藏；不要横向滚动表格。图表宽度 100%，父级 `min-w-0`。
- 长英文/URL 只在代码块内 `break-all`；卡片内避免整段等宽长串。
- 首屏 H1 最多 3 行；如超出自适应，优先缩小到 34px，不换行成 4 行。

### 10.3 768

- 首屏仍单列（文案在上、图在下）或 5:4 双栏，主视觉 280–320；不要三栏。
- 统计 3 列；第 4/5 项换行，跨列规则保持清晰。
- 插件列表仍用卡片（现有 `lg` 断点正确）；卡片内指标 2 列。
- 筛选器 3–4 个换行，高度 44；高级筛选默认折叠。
- 图表 360；轴标签 11px 不隐藏；图例可换行。
- 区块间距 56；面板内边距 20。

### 10.4 1440

- 首屏双栏：文案 0.92fr / 图表 1.08fr（保留现有比例），主视觉 480–520，允许右侧出血 8–12%。
- 统计 5 列一条数据带；数字 44px。
- 插件表格 7 列；长名截断；数字右对齐；表头 12px。
- 榜单双栏；区块间距 72；留白充足，避免卡片同质堆叠。
- 图表 420（首页）/540（四象限页）；网格线不加密。

### 10.5 溢出与断行检查

- 全站 `html, body { overflow-x: clip; }` 仅作兜底，不允许依赖它掩盖问题。
- 每个 grid/flex 子项：`min-width: 0`；图表容器：`min-w-0`。
- 表格：`table-layout: fixed`；数字列 `whitespace-nowrap`；名称列 `truncate`。
- 验收：390/768/1440 下 `document.documentElement.scrollWidth <= window.innerWidth`。
- 中文不`word-break: break-all`；仅代码/仓库/安装命令允许。

---

## 11. 动效与性能

| 场景 | 时长 | 缓动 | 备注 |
|---|---:|---|---|
| 页面进入 | 120ms | ease-out | 仅透明度 |
| 按钮/链接 | 120ms | ease-out | 颜色/边框，不做位移 |
| 面板 hover | 0ms | — | 不抬升 |
| tooltip | 120ms | ease-out | 透明度 |
| 折叠 | 0ms | — | 不做高度动画 |
| 图表 | 200ms | cubicOut | `prefers-reduced-motion` 下 0 |
| 主视觉入场（可选） | 400ms | ease-out | 透明度 + 8px 位移 |

- 全局 `prefers-reduced-motion` 规则保留；加载脉冲在 reduce-motion 下停止。
- 不引入动画库；不使用 `transition: all`（改为 `transition-colors` 或具体属性）。
- 不新增 npm 依赖；SVG 内联；无外网字体；主视觉 ≤8KB。
- 图表按需初始化（现有 `useEChart`）；不在滚动中重建 option。
- 避免大面积 `backdrop-filter`；仅 header 使用现有 `backdrop-blur-sm`，主视觉用 alpha 渐变。

---

## 12. 可访问性验收（WCAG AA）

- [ ] 正文/辅助文字 ≥4.5:1；大字号 ≥3:1；控件边界 ≥3:1（`line-control` 3.47）。
- [ ] 焦点可见：所有按钮、链接、输入、select、summary、图表可点区域；2px 墨色 outline + 2px offset。
- [ ] 键盘可达：导航、筛选、分页、图表点击替代（详情链接/表格）、tooltip（Escape 关闭）。
- [ ] 触控目标 ≥44×44（390/768）。
- [ ] 状态不只靠颜色：风险有图标+文字；状态灯有文字；过期有文字；图例有文字。
- [ ] 图表有 `aria-label` 与 sr-only 数据表；颜色对比达标。
- [ ] `prefers-reduced-motion` 下无动画；`prefers-contrast: more` 下点阵标题回退实心。
- [ ] 文本缩放 200% 不横向溢出；点阵用 `em` 缩放。
- [ ] 表单 label 可见或 `sr-only`；错误提示与字段关联（`aria-describedby`）。
- [ ] 空状态/错误状态有可执行动作；不是只有一句“无数据”。

---

## 13. 落地清单（交给前端）

### 13.1 文件级修改点

| 文件 | 修改 |
|---|---|
| `src/index.css` | 替换 `:root`；焦点改墨色；`::selection`；滚动条；`.panel/.data-band/.select-field/.tnum`；新增 `.stamp/.index/.readout/.tick-ruler/.dot-matrix` |
| `tailwind.config.ts` | 颜色、字号、字距、圆角、阴影映射；保留兼容别名 |
| `src/components/ui.tsx` | 按钮 variant 颜色；`ScoreBar` 改 `series-bar`；`DataCoverage` 改墨色；`CategoryTag` 点改方形墨色；`RiskBadge` 用风险 token；`Pagination` 当前页品牌红；`InfoHint` 6px 圆角/新阴影；`EmptyState` 虚线框 |
| `src/components/charts/chartTheme.ts` | 按 §7.2 全量替换 hex |
| `src/components/charts/QuadrantChart.tsx` | 高风险 halo series；轴 11px；阈值标签；图例非颜色线索；tooltip 6px 圆角 |
| `src/components/charts/ScoreTrendChart.tsx` | 系列色、轴/网格、图例、emphasis |
| `src/components/charts/DownloadBars.tsx` | 柱色/圆角/缺数区、图例 |
| `src/pages/HomePage.tsx` | `QUADRANT_DOT` 去 `bg-accent`；首屏字号；插入主视觉；图表高度 280/360/420 |
| `src/pages/QuadrantPage.tsx` | 同上；图表 420/480/540；标题字号 |
| `src/components/RankList.tsx` | 顶部条 `border-series-popularity` / `border-series-maintenance`，不用品牌红 |
| `src/components/layout/Header.tsx` | 品牌标识银底红图标；激活导航 2px 品牌红；状态灯 + 文字；控件 44 |
| `src/pages/MethodPage.tsx` | 章节编号 `text-accent` 改 `text-content-muted`；2px 品牌左条保留为“当前项/刻度”；公式/说明用新字体层级 |
| `src/components/layout/DataNotices.tsx` | 系统警告/错误用 `warning`/`danger` 浅底 + 图标 + 文案；不与高风险 chip 混用 |
| `src/components/layout/Footer.tsx` | 品牌点保留；链接 hover 用 `brand-text`；时间戳用 `.timestamp` |
| `src/components/Insights.tsx` | “最近变化”品牌点可保留（有文字说明）；风险 chip 用新 token |
| `index.html` | `theme-color` 改 `#F4F4F2` |

### 13.2 旧类名 → 新类名

| 旧 | 新 | 说明 |
|---|---|---|
| `bg-accent`（数据/分类/象限） | `bg-series-popularity` / `bg-content-primary` | 数据不再用品牌红 |
| `bg-accent`（主按钮） | `bg-brand` | 语义同名，值变红 |
| `text-accent`（链接 hover） | `text-brand-text` | 白底/画布更稳 |
| `text-accent`（章节编号/装饰） | `text-content-muted` + `.stamp` | 编号不是动作，不用红 |
| `border-accent-line bg-accent-soft text-accent-active`（激活筛选） | `border-brand-line bg-brand-soft text-brand-text` | 保留交互语义 |
| `bg-teal` | `bg-series-maintenance` | 维护系列 |
| `border-teal`（榜单） | `border-series-maintenance` | 同上 |
| `ring-accent` / `ring-accent-soft` | 删除，使用全局 outline | 避免双焦点环 |
| `rounded-panel` 8px | 6px | token 改值 |
| `rounded-control` 6px | 4px | token 改值 |
| `text-danger`（高风险） | `text-risk-high` | 系统错误才用 `danger` |
| `text-warning`（风险中） | `text-risk-medium` | 系统警告用 `warning` |

### 13.3 验收命令

```bash
npm run typecheck
npm test
npm run build
```

浏览器检查：
- 390 / 768 / 1440 三档，无横向滚动。
- 灰度截图：品牌按钮 vs 高风险 chip 可区分。
- Network：无字体请求、无新增图片。
- 对比度抽查：正文、辅助、风险 chip、tooltip、坐标轴。
- 键盘 Tab 全流程；Escape 关闭 tooltip；reduce-motion 下无动画。

---

## 14. 未决项 / 交接

1. **首屏主视觉位置**：本文只定义视觉与尺寸；放左/放右、是否出血由 `02-ux-layout.md` 决定。
2. **768 表格**：维持现有 `lg` 断点用卡片；若 UX 要求 768 上表格，需单独验证横向空间（7 列在 720px 内容宽下不可行）。
3. **ECharts `select` API**：需在安装的 ECharts 5 版本确认 scatter 的 `selectedMode/select` 支持；若不支持，用“点击后写入 activeId + 额外 scatter 系列绘制墨色环”实现同等效果。
4. **严格点阵字形**：本轮为 CSS 半调点阵，不是 5×7 LED 字体；若品牌要求严格点阵，需自托管子集字体并重新评估包体与授权。
5. **品牌红面积**：若实际页面品牌红超过 2%，优先减少按钮/下划线，不要把风险色改浅来“让红更突出”。
6. **数据与文案**：本文不改变任何数据、评分、来源、更新时间或缺失说明；实现时不得用装饰数字替代真实值。

---

**交付**：UI Designer
**版本**：v1.0
**日期**：2026-10-20
**基线**：`785c8f2`
**下一步**：与 `02-ux-layout.md` 对齐布局，再由前端按 §13 落地。
