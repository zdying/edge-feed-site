const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const ejs = require('ejs');

// 配置路径
const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');
const postsDir = path.join(srcDir, 'posts');
const templatePath = path.join(srcDir, 'layout.ejs');

async function build() {
    try {
        console.log('🚀 开始构建 Kairalert Blog...');

        // 1. 清理并重建 dist 目录
        await fs.emptyDir(distDir);

        // 2. 复制静态资源 (CSS, Images, JS)
        if (await fs.pathExists(path.join(srcDir, 'assets'))) {
            await fs.copy(path.join(srcDir, 'assets'), path.join(distDir, 'assets'));
        }

        // 3. 读取所有 Markdown 文件
        const files = await fs.readdir(postsDir);
        const posts = [];

        // 4. 遍历处理每一篇文章
        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const filePath = path.join(postsDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');

            // 解析 Front Matter (元数据) 和 内容
            const { data: meta, content } = matter(fileContent);

            // 将 Markdown 转换为 HTML
            const htmlContent = marked(content);

            // 生成输出文件名 (比如: my-post.md -> my-post.html)
            const slug = file.replace('.md', '.html');

            // 存入数组，稍后用于生成列表页
            posts.push({
                title: meta.title,
                date: meta.date,
                desc: meta.desc || '',
                link: `/blog/${slug}`, // 假设博客在子目录下，或者直接 `/${slug}`
                slug: slug
            });

            // 使用 EJS 渲染完整 HTML (注入 Header/Footer)
            const fullHtml = await ejs.renderFile(templatePath, {
                title: meta.title + ' - Kairalert', // 页面 Title
                content: htmlContent,                // 文章正文
                isIndex: false,                      // 标记这不是首页
                meta: meta                           // 传递元数据供模板使用
            });

            // 写入 dist 目录
            await fs.outputFile(path.join(distDir, 'blog', slug), fullHtml);
            console.log(`✅ 生成文章: ${slug}`);
        }

        // 5. 生成博客列表页 (Blog Index)
        // 按日期排序
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        const indexHtml = await ejs.renderFile(templatePath, {
            title: 'Blog - Kairalert Pro',
            content: '', // 列表页不需要 Markdown 内容，我们在 layout 里特殊处理
            isIndex: true,
            posts: posts // 将文章列表传给模板
        });

        await fs.outputFile(path.join(distDir, 'blog', 'index.html'), indexHtml);
        console.log('✅ 生成列表页: index.html');

        console.log('🎉 构建完成!');

    } catch (error) {
        console.error('❌ 构建失败:', error);
    }
}

build();