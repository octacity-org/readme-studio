import heading from 'lucide-static/icons/heading-2.svg?url';
import link from 'lucide-static/icons/link.svg?url';
import image from 'lucide-static/icons/image.svg?url';
import code from 'lucide-static/icons/code.svg?url';
import table from 'lucide-static/icons/table-2.svg?url';
import details from 'lucide-static/icons/chevrons-up-down.svg?url';
import centered from 'lucide-static/icons/align-center.svg?url';
import badge from 'lucide-static/icons/shield-check.svg?url';
import template from 'lucide-static/icons/panels-top-left.svg?url';
import text from 'lucide-static/icons/type.svg?url';
import stack from 'lucide-static/icons/layers.svg?url';
import social from 'lucide-static/icons/users.svg?url';
import stats from 'lucide-static/icons/chart-no-axes-combined.svg?url';
import views from 'lucide-static/icons/eye.svg?url';
import snake from 'lucide-static/icons/worm.svg?url';
import arcade from 'lucide-static/icons/gamepad-2.svg?url';
import articles from 'lucide-static/icons/newspaper.svg?url';
import capsule from 'lucide-static/icons/rows-3.svg?url';
import toc from 'lucide-static/icons/list.svg?url';
import tree from 'lucide-static/icons/folder-tree.svg?url';
import outline from 'lucide-static/icons/list-tree.svg?url';
import checks from 'lucide-static/icons/list-checks.svg?url';
import download from 'lucide-static/icons/download.svg?url';
import pen from 'lucide-static/icons/pen-line.svg?url';
import fileCode from 'lucide-static/icons/file-code-2.svg?url';
import github from 'lucide-static/icons/git-branch.svg?url';
import collapse from 'lucide-static/icons/panel-left-close.svg?url';
import expand from 'lucide-static/icons/panel-left-open.svg?url';

const icons = {
  heading, link, image, code, table, details, centered, badge,
  'profile-template': template,
  'profile-image': image,
  'profile-text': text,
  'tech-stack': stack,
  'social-links': social,
  'github-stats': stats,
  'profile-views': views,
  snake, arcade, medium: articles, capsule, toc, tree,
  document: outline, checks, export: download,
  visual: pen, markdown: fileCode, github, collapse, expand,
} as const;

export function ToolIcon(props: { readonly tool: keyof typeof icons }) {
  return <span class="tool-icon" aria-hidden="true"><span class="tool-icon-glyph" style={{ 'mask-image': `url("${icons[props.tool]}")` }} /></span>;
}
