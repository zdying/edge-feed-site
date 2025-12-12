const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const ejs = require('ejs');

// === 配置路径 ===
// 假设脚本在 /scripts 目录下，.. 代表项目根目录
const distBase = path.join(__dirname, '..', 'blog');      // 输出总目录
const postsBase = path.join(__dirname, '..', 'md');       // Markdown 总目录
const templatePath = path.join(__dirname, '..', 'tmpl/post.ejs');

// 定义支持的语言代码
const languages = ['en', 'zh'];

async function build() {
    try {
        console.log('🚀 开始构建多语言 Kairalert Blog...');

        // 1. 清理输出目录 (../blog)
        await fs.emptyDir(distBase);

        // 2. 复制静态资源 (如果需要的话，通常静态资源放在网站根目录，不需要放在 blog 下)
        // if (await fs.pathExists(path.join(__dirname, '..', 'assets'))) {
        //     await fs.copy(path.join(__dirname, '..', 'assets'), path.join(distBase, 'assets'));
        // }

        // 3. 循环构建每种语言
        for (const lang of languages) {
            await buildLanguage(lang);
        }

        // 4. 生成根目录的重定向文件 (../blog/index.html)
        // 当用户访问 /blog/ 时，自动跳到英文版 /blog/en/
        const redirectHtml = `<meta http-equiv="refresh" content="0;url=/blog/en/">`;
        await fs.outputFile(path.join(distBase, 'index.html'), redirectHtml);
        console.log(`✅ 生成根目录跳转: /blog/ -> /blog/en/`);

        console.log('🎉 全部构建完成!');

    } catch (error) {
        console.error('❌ 构建失败:', error);
    }
}

// === 单语言构建逻辑 ===
async function buildLanguage(lang) {
    const srcDir = path.join(postsBase, lang);  // 例如: ../md/en
    const distDir = path.join(distBase, lang);  // 例如: ../blog/en

    // 如果该语言的源文件夹不存在，跳过
    if (!await fs.pathExists(srcDir)) {
        console.log(`⚠️ 跳过 [${lang}]: 目录不存在 (${srcDir})`);
        return;
    }

    console.log(`\n正在构建 [${lang.toUpperCase()}] 版本...`);

    const files = await fs.readdir(srcDir);
    const posts = [];

    // 遍历处理每一篇文章
    for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(srcDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // 解析元数据
        const { data: meta, content } = matter(fileContent);

        // 转换 Markdown -> HTML
        const htmlContent = marked(content);

        // 生成 slug (文件名)
        const slug = file.replace('.md', '.html');

        // 生成最终 URL 链接 (关键点：带上语言前缀)
        // 结果示例: /blog/en/my-post.html
        const postLink = `/blog/${lang}/${slug}`;

        posts.push({
            title: meta.title,
            date: meta.date,
            desc: meta.desc || '',
            category: meta.category || 'General',
            link: postLink,
            slug: slug
        });

        // 渲染文章详情页
        const fullHtml = await ejs.renderFile(templatePath, {
            lang: lang,                      // 传入当前语言，用于模板判断
            title: meta.title + ' - Kairalert',
            content: htmlContent,
            isIndex: false,
            meta: meta,
            pathPrefix: `/blog/${lang}/`     // 方便模板里生成面包屑或返回链接
        });

        // 写入文件 (例如: ../blog/en/my-post.html)
        await fs.outputFile(path.join(distDir, slug), fullHtml);
        console.log(`  -> 文章: ${slug}`);
    }

    // 生成列表页 (Index)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 根据语言决定列表页标题
    const indexTitle = lang === 'zh' ? '最新洞察 - Kairalert' : 'Insights - Kairalert';

    const indexHtml = await ejs.renderFile(templatePath, {
        lang: lang,
        title: indexTitle,
        content: '',
        isIndex: true,
        posts: posts,
        pathPrefix: `/blog/${lang}/`
    });

    await fs.outputFile(path.join(distDir, 'index.html'), indexHtml);
    console.log(`  -> 列表页: index.html (${posts.length} 篇)`);
}

build();