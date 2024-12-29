// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded "><a href="app.html"><strong aria-hidden="true">1.</strong> 应用</a></li><li class="chapter-item expanded "><a href="arche.html"><strong aria-hidden="true">2.</strong> 原型</a></li><li class="chapter-item expanded "><a href="ecs.html"><strong aria-hidden="true">3.</strong> ECS</a></li><li class="chapter-item expanded "><a href="entities.html"><strong aria-hidden="true">4.</strong> 实体</a></li><li class="chapter-item expanded "><a href="components.html"><strong aria-hidden="true">5.</strong> 组件</a></li><li class="chapter-item expanded "><a href="system.html"><strong aria-hidden="true">6.</strong> 系统</a></li><li class="chapter-item expanded "><a href="commands.html"><strong aria-hidden="true">7.</strong> 命令</a></li><li class="chapter-item expanded "><a href="assets.html"><strong aria-hidden="true">8.</strong> 资产</a></li><li class="chapter-item expanded "><a href="audio.html"><strong aria-hidden="true">9.</strong> 音频</a></li><li class="chapter-item expanded "><a href="camera.html"><strong aria-hidden="true">10.</strong> 相机</a></li><li class="chapter-item expanded "><a href="sprite.html"><strong aria-hidden="true">11.</strong> 精灵</a></li><li class="chapter-item expanded "><a href="timer.html"><strong aria-hidden="true">12.</strong> 计时器</a></li><li class="chapter-item expanded "><a href="data.html"><strong aria-hidden="true">13.</strong> 数据类型</a></li><li class="chapter-item expanded "><a href="behaviors.html"><strong aria-hidden="true">14.</strong> 行为</a></li><li class="chapter-item expanded "><a href="resource.html"><strong aria-hidden="true">15.</strong> 资源</a></li><li class="chapter-item expanded "><a href="bundle.html"><strong aria-hidden="true">16.</strong> Bundle</a></li><li class="chapter-item expanded "><a href="query.html"><strong aria-hidden="true">17.</strong> 查询</a></li><li class="chapter-item expanded "><a href="coordinate.html"><strong aria-hidden="true">18.</strong> 坐标系</a></li><li class="chapter-item expanded "><a href="rendering.html"><strong aria-hidden="true">19.</strong> 渲染</a></li><li class="chapter-item expanded "><a href="transform.html"><strong aria-hidden="true">20.</strong> 变换</a></li><li class="chapter-item expanded "><a href="time.html"><strong aria-hidden="true">21.</strong> 时间</a></li><li class="chapter-item expanded "><a href="load_assets.html"><strong aria-hidden="true">22.</strong> 加载资产</a></li><li class="chapter-item expanded "><a href="keyboard.html"><strong aria-hidden="true">23.</strong> 键盘</a></li><li class="chapter-item expanded "><a href="mouse.html"><strong aria-hidden="true">24.</strong> 鼠标</a></li><li class="chapter-item expanded "><a href="window.html"><strong aria-hidden="true">25.</strong> 窗口</a></li><li class="chapter-item expanded "><a href="event.html"><strong aria-hidden="true">26.</strong> 事件</a></li><li class="chapter-item expanded "><a href="local.html"><strong aria-hidden="true">27.</strong> 本地资源</a></li><li class="chapter-item expanded "><a href="schedule.html"><strong aria-hidden="true">28.</strong> Schedule</a></li><li class="chapter-item expanded "><a href="state.html"><strong aria-hidden="true">29.</strong> 状态</a></li><li class="chapter-item expanded "><a href="plugin.html"><strong aria-hidden="true">30.</strong> 插件</a></li><li class="chapter-item expanded "><a href="change_detection.html"><strong aria-hidden="true">31.</strong> 变化检测</a></li><li class="chapter-item expanded "><a href="parent_child.html"><strong aria-hidden="true">32.</strong> 父子组件</a></li><li class="chapter-item expanded "><a href="visibility.html"><strong aria-hidden="true">33.</strong> 可见性</a></li><li class="chapter-item expanded "><a href="hdr.html"><strong aria-hidden="true">34.</strong> HDR和色调映射</a></li><li class="chapter-item expanded "><a href="bloom.html"><strong aria-hidden="true">35.</strong> 辉光</a></li><li class="chapter-item expanded "><a href="ime.html"><strong aria-hidden="true">36.</strong> 输入法</a></li><li class="chapter-item expanded "><a href="code.html"><strong aria-hidden="true">37.</strong> 代码组织</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString();
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
