/**
 * Strapi v5 Admin Panel 自定义入口
 *
 * 修复 BUG：媒体库 AssetCard 的 CardCheckbox 默认样式为
 *   opacity: 0 / pointer-events: none / z-index: 0
 * 导致用户 hover 已上传图片时看不到勾选框，无法选中并回填字段。
 *
 * 临时方案：通过 bootstrap 钩子注入 CSS，强制 checkbox 始终可见可点击。
 * 长期方案：等待 Strapi 上游修复（v5.50.2 仍存在此问题）。
 */

export default {
  bootstrap() {
    if (typeof document === 'undefined') return;

    // 避免重复注入
    if (document.getElementById('strapi-media-checkbox-fix')) return;

    const style = document.createElement('style');
    style.id = 'strapi-media-checkbox-fix';
    style.textContent = `
      /* AssetCard 内的 CardCheckbox 始终可见 */
      [class*="asset-card"] [role="checkbox"],
      [class*="AssetCard"] [role="checkbox"],
      [class*="asset-card"] input[type="checkbox"],
      [class*="AssetCard"] input[type="checkbox"] {
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: 10 !important;
      }
    `;
    document.head.appendChild(style);
  },
};
