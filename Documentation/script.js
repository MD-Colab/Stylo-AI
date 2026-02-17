document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById('content-area');
    const sidebarNav = document.getElementById('sidebar-nav');
    const themeToggle = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-input');
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const sidebar = document.getElementById('sidebar');

    // =========================================================================
    //  PAGES CONTENT OBJECT
    //  All 27 pages of documentation are defined here.
    // =========================================================================
    const pages = {
        'introduction': {
            title: 'Introduction to Stylo AI',
            content: `
                <h1>Introduction to Stylo AI V2</h1>
                <h2>The Conversational Workspace for Modern Web Creation</h2>
                <p>Stylo AI represents a monumental leap forward in web development, creating a new paradigm where the only prerequisite to building a professional, data-driven website is a clear vision. At its core, Stylo AI is a conversational workspace that combines a powerful AI assistant with a full suite of development tools. It fundamentally reimagines the creative process by removing the traditional barriers of complex code and rigid design software. Instead of manipulating builders or writing boilerplate, you engage in a natural language conversation with a highly advanced AI that acts as your personal developer, designer, and full-stack engineer.</p>
                <p>This documentation is your comprehensive guide to unlocking the full potential of Stylo AI V2. You will learn how to articulate your ideas effectively, refine and customize AI-generated creations, manage powerful features like databases and e-commerce stores with simple commands, and collaborate with your team in a seamless, real-time environment. Our philosophy is that technology should be an enabler, not a gatekeeper. We are incredibly excited to see the amazing things you will build.</p>
                <blockquote>Our mission is to democratize web development by making it as simple and intuitive as having a conversation with an expert, backed by professional-grade tools.</blockquote>
                <h3>What's New in V2?</h3>
                <p>Version 2 is a massive upgrade, transforming Stylo AI from a simple generator into a complete development environment:</p>
                <ul>
                    <li><strong>Workspaces & Teams:</strong> Collaborate with your team in shared workspaces with role-based permissions.</li>
                    <li><strong>Advanced IDE:</strong> A multi-file, VS Code-inspired editor with tabs, a file tree, and contextual AI assistance.</li>
                    <li><strong>Visual "Drag & Drop" Editor:</strong> For when you want hands-on control, a powerful visual builder is just a click away.</li>
                    <li><strong>E-commerce & 3D Blueprints:</strong> Generate fully functional online stores or interactive 3D websites with single prompts.</li>
                    <li><strong>Project Wizard:</strong> A guided questionnaire to help the AI understand your needs and craft the perfect initial prompt for you.</li>
                    <li><strong>"Ask AI" Debugging Panel:</strong> A dedicated chat to ask questions about your existing code and get specific fixes.</li>
                    <li><strong>Full Profile Dashboard:</strong> Manage your profile, teams, billing, images, databases, and API keys from a central hub.</li>
                </ul>
            `
        },
        'quick-start': {
            title: 'Quick Start Guide',
            content: `
                <h1>Quick Start: From Idea to Live in 5 Minutes</h1>
                <p>This guide provides a whirlwind tour of the core Stylo AI V2 workflow. By following these steps, you'll create, refine, and deploy your first website using the new and improved interface.</p>
                
                <h2>Step 1: Create a New Project with the Wizard</h2>
                <p>Upon entering the editor, click the <strong>"+ New Project"</strong> button. After naming your project (e.g., "Innovatech Landing Page"), the new <strong>Project Wizard</strong> will launch. This guided questionnaire will ask you about your project's purpose, design aesthetic, and required features. Answering these questions helps the AI formulate a highly detailed initial prompt, ensuring the first generation is incredibly close to your vision.</p>
                
                <h2>Step 2: Generate and Review</h2>
                <p>After completing the wizard, the AI will automatically generate the website. Watch as the Live Preview in the center Workspace populates with a complete, multi-section website. The AI has not only scaffolded the structure but also implemented your chosen theme, written relevant placeholder copy, and ensured the layout is fully responsive. Use the responsive toggles (desktop, tablet, mobile icons) at the top of the Workspace to verify its appearance on all screen sizes.</p>
                
                <h2>Step 3: Refine with a Follow-up Command</h2>
                <p>The real power of Stylo AI lies in iterative refinement. Let's say you want to change the color of the buttons. In the "Create" panel's chat input, simply type:</p>
                <pre><code>Change all the primary buttons to have a gradient background from blue to purple.</code></pre>
                <p>The AI understands the context and will surgically modify only the relevant Tailwind CSS classes, updating the Live Preview instantly without affecting the rest of the site.</p>

                <h2>Step 4: Make a Manual Tweak with the IDE</h2>
                <p>For precise control, click the <strong>&lt;i class="fas fa-code"&gt;&lt;/i&gt; Code Editor</strong> button in the header toolbar. This opens the new multi-file IDE. Navigate to the <code>index.html</code> file, find the headline text, and make a small change. Click the <strong>&lt;i class="fas fa-play"&gt;&lt;/i&gt; Run</strong> button to see your manual edit reflected in the main Live Preview.</p>
                
                <h2>Step 5: Save and Deploy</h2>
                <p>Once you're satisfied, click the main <strong>&lt;i class="fas fa-save"&gt;&lt;/i&gt; Save</strong> button in the header toolbar. After saving, the <strong>&lt;i class="fas fa-rocket"&gt;&lt;/i&gt; Deploy</strong> button next to it becomes active. Clicking "Deploy" initiates the automated hosting process. In moments, the button group will update to show a green <strong>&lt;i class="fas fa-external-link-alt"&gt;&lt;/i&gt; Visit</strong> button. Click it to see your website live on a public URL. Congratulations!</p>
            `
        },
        'account-setup': {
            title: 'The Profile Dashboard',
            content: `
                <h1>The Profile Dashboard</h1>
                <p>Your Stylo AI account is managed through a comprehensive Profile Dashboard, your central hub for all personal and administrative tasks. To access it, click your avatar in the top-right corner of any page and select "My Profile."</p>
                <p>The dashboard is organized into several sections, accessible via the sidebar navigation:</p>
                <ul>
                    <li><strong>Profile:</strong> Update your public information, including your display name, bio, and avatar. This information is visible to your team members.</li>
                    <li><strong>Pricing & Billing:</strong> Manage your subscription plan. Upgrade or downgrade between our Free, Startup, Pro, and Business tiers to unlock more features and higher limits. Billing is handled securely through Razorpay.</li>
                    <li><strong>Teams & Collab:</strong> This is where you create and manage your Workspaces. Invite new members to your team, manage existing ones, and view pending invitations from others.</li>
                    <li><strong>My Images:</strong> A global gallery of all images you've uploaded across all your projects, allowing you to manage and export them between projects.</li>
                    <li><strong>Databases:</strong> View all database collections from all your projects in one unified interface.</li>
                    <li><strong>API Keys:</strong> Generate and manage Personal Access Tokens for programmatic access to the Stylo AI API.</li>
                    <li><strong>Account:</strong> Access the "Danger Zone" to permanently delete your account and all associated data.</li>
                </ul>
                <p>We highly recommend exploring the dashboard to familiarize yourself with all the new management tools available in V2.</p>
            `
        },
        'understanding-the-ui': {
            title: 'Understanding the Editor UI',
            content: `
                <h1>Understanding the V2 Editor UI</h1>
                <p>The Stylo AI V2 editor is a powerful, multi-functional workspace. It is logically divided into several key zones to streamline your workflow from idea to deployment.</p>
                
                <h2>1. The Header</h2>
                <p>The main header provides global navigation and project management.</p>
                <ul>
                    <li><strong>Project Selector Dropdown:</strong> Located at the top-left, this is your primary tool for switching between projects. It features a search bar and lists all projects you own or are a collaborator on. You can also create new projects from here.</li>
                    <li><strong>Header Toolbar:</strong> This central area appears when a project is loaded. It contains button groups for core actions:
                        <ul>
                            <li><strong>Deployment:</strong> Deploy, Re-deploy, or Visit your live site.</li>
                            <li><strong>Editors:</strong> Toggle the Visual Editor (&lt;i class="fas fa-palette"&gt;&lt;/i&gt;) or the Code Editor/IDE (&lt;i class="fas fa-code"&gt;&lt;/i&gt;).</li>
                            <li><strong>Management:</strong> Access Version History, manage Project Databases, and manage Project Images.</li>
                            <li><strong>Saving:</strong> The main Save button for your project.</li>
                        </ul>
                    </li>
                    <li><strong>User Profile & Auth:</strong> On the right, you can access your profile, sign out, or toggle dark mode.</li>
                </ul>

                <h2>2. The Control Panel (Left)</h2>
                <p>This panel is your main conversational interface with the AI.</p>
                <ul>
                    <li><strong>Panel Tabs:</strong> Switch between two modes:
                        <ul>
                            <li><strong>&lt;i class="fas fa-magic"&gt;&lt;/i&gt; Create:</strong> The main chat for generating and refining your website.</li>
                            <li><strong>&lt;i class="fas fa-question-circle"&gt;&lt;/i&gt; Ask AI:</strong> A dedicated debugging chat to ask questions about your current code and get specific fixes.</li>
                        </ul>
                    </li>
                    <li><strong>Chat History:</strong> Displays the conversation for the active panel.</li>
                    <li><strong>Chat Input:</strong> Where you type your prompts. It supports file attachments, the "Enhance Prompt" feature, and @/# mentions.</li>
                </ul>

                <h2>3. The Workspace (Center)</h2>
                <p>The central Workspace is where your creation comes to life and is visualized.</p>
                <ul>
                    <li><strong>Responsive Toggles:</strong> Instantly resize the preview to test your site on desktop, tablet, and mobile layouts.</li>
                    <li><strong>Live Preview (iframe):</strong> A fully interactive, sandboxed iframe that renders your website's code in real-time.</li>
                </ul>
            `
        },
        // =========================================================================
        //  CORE FEATURES (UPDATED)
        // =========================================================================
        'ai-chat': {
            title: 'The AI Chat & "Ask AI"',
            content: `
                <h1>The AI Chat & "Ask AI"</h1>
                <p>Stylo AI V2 enhances its conversational capabilities by splitting the AI interaction into two distinct, purpose-driven panels: "Create" and "Ask AI".</p>

                <h2>The "Create" Panel</h2>
                <p>This is the primary chat interface for generative work. Use this panel to:</p>
                <ul>
                    <li>Generate new websites from scratch.</li>
                    <li>Add new sections or pages.</li>
                    <li>Make broad stylistic or structural changes.</li>
                    <li>Rewrite content.</li>
                </ul>
                <h3>Advanced "Create" Features:</h3>
                <ul>
                    <li><strong>&lt;i class="fas fa-wand-sparkles"&gt;&lt;/i&gt; Enhance Prompt:</strong> Click the magic wand icon to have the AI rewrite your simple idea into a detailed, technical prompt for better results.</li>
                    <li><strong>&lt;i class="fas fa-paperclip"&gt;&lt;/i&gt; Attach Files:</strong> Upload images or data files (like .csv, .json) directly into the chat. The AI will analyze the file and use it as context. Uploaded images can be used directly in the design.</li>
                    <li><strong>URL Scraping:</strong> Simply paste a URL into the chat. The AI will scrape the content and structure of the page, allowing you to replicate or redesign existing websites.</li>
                </ul>
                <h3>Deep URL Scraping & Design Replication</h3>
<p>Stylo AI V2 doesn't just "visit" a link; it performs a deep analysis of the target website to provide rich context for your generation.</p>
<ul>
    <li><strong>Image Extraction:</strong> Our scraper identifies and extracts the top 15 high-quality images from the URL. You can then ask the AI, <em>"Use the same hero image from the link I shared"</em>, and it will know exactly which one to use.</li>
    <li><strong>Structural Analysis:</strong> The AI reads the semantic structure (Heads, Navs, Sections) to understand the layout hierarchy of the source site.</li>
    <li><strong>Content Context:</strong> It cleans and extracts up to 15,000 characters of text, allowing you to say <em>"Rewrite the content of my site based on the info from this URL"</em>.</li>
</ul>
<p><strong>How to use:</strong> Simply paste any public URL into the chat. You will see an <em>(Analyzed URL)</em> notification, confirming the AI has absorbed that site's data.</p>

                <h2>The "Ask AI" Panel</h2>
                <p>This new panel is a dedicated debugging and code-assistance tool. It's designed for asking specific questions about the *currently existing code* in your project.</p>
                <p>Use this panel to:</p>
                <ul>
                    <li>Ask "Why is this button not centered?"</li>
                    <li>Get explanations for parts of the code: "Explain what this JavaScript function does."</li>
                    <li>Request specific fixes: "Fix the alignment issue in the navbar on mobile."</li>
                    <li>Get suggestions for improvement: "How can I make this section more accessible?"</li>
                </ul>
                <p>The "Ask AI" panel provides code snippets as answers, which you can copy or automatically apply. It's like having a senior developer on call to help you understand and perfect your code without altering the entire site structure.</p>
            `
        },
        'generating-websites': { 
            title: 'Generating Websites: 3D & E-commerce', 
            content: `
                <h1>Generating Websites: 3D & E-commerce</h1>
                <p>Stylo AI V2 introduces highly specialized blueprints for generating complex, interactive websites with a single prompt. The AI is now trained to automatically detect your intent and deploy these powerful new templates.</p>
                
                <h2>Automatic 3D Website Generation</h2>
                <p>You can now create stunning, interactive 3D web experiences just by asking. The AI is trained to recognize a wide range of keywords related to 3D, such as "3D model," "rotate product," "interactive scene," or "three.js".</p>
                <p>When a 3D request is detected, the AI will automatically:</p>
                <ol>
                    <li>Include the Three.js library in your project.</li>
                    <li>Create an HTML \`<canvas>\` element to render the 3D scene.</li>
                    <li>Set up a camera, lighting, and orbit controls so the user can interact (drag, zoom) with the scene.</li>
                    <li>If you provide a link to a <code>.glb</code> or <code>.gltf</code> model, it will load that model. Otherwise, it will generate a placeholder 3D object (like a cube or sphere).</li>
                </ol>
                <pre><code>// Example 3D Prompt
"Create a landing page for a futuristic product. The hero section should feature a large, interactive 3D model of a rotating blue crystal."</code></pre>

                <h2>Full-Featured E-commerce Blueprint</h2>
                <p>Building an online store is now faster than ever. By using keywords like "e-commerce," "shop," or "sell products," you activate a powerful blueprint that generates a complete client-side store.</p>
                <p>The E-commerce blueprint automatically includes:</p>
                <ul>
                    <li><strong>Product & Orders Databases:</strong> Automatically creates the necessary database collections in your project.</li>
                    <li><strong>Admin Panel:</strong> A dedicated section (often styled differently or placed at an #admin route) with a form to add new products, including name, price, description, and image upload.</li>
                    <li><strong>Public Product Grid:</strong> A customer-facing gallery that displays items from your "Products" database in real-time.</li>
                    <li><strong>Shopping Cart:</strong> A fully functional cart (usually a modal) with JavaScript to handle adding/removing items, updating quantities, and calculating totals. It uses Local Storage for persistence.</li>
                    <li><strong>Checkout Form:</strong> A form that collects customer details and saves the final order to your "Orders" database.</li>
                </ul>
                 <pre><code>// Example E-commerce Prompt
"Generate a clean, modern e-commerce website to sell handmade pottery. Include an admin panel to add products and a shopping cart."</code></pre>
            ` 
        },

        'editing-refining': { 
            title: 'Refining: AI Chat, Visual Editor & IDE', 
            content: `
                <h1>Refining Your Site: A Multi-Tool Approach</h1>
                <p>Stylo AI V2 provides three powerful ways to edit and refine your website, each suited for different tasks. You can seamlessly switch between them to achieve the perfect result with maximum efficiency.</p>

                <h2>1. Conversational Refinement (AI Chat)</h2>
                <p>The "Create" chat panel remains the fastest way to make broad changes. It's best for tasks that affect multiple elements or require creative input from the AI.</p>
                <ul>
                    <li><strong>Best for:</strong> Overall style changes ("Make the theme more corporate"), adding new sections ("Add a 4-item feature grid"), rewriting content, or applying complex functional changes.</li>
                    <li><strong>How:</strong> Simply type your request in the chat. The AI analyzes the current code and your prompt to make surgical updates.</li>
                </ul>

                <h2>2. The Visual Editor (Drag & Drop)</h2>
                <p>For hands-on, visual adjustments, the new Visual Editor is your best tool. Access it via the <strong>&lt;i class="fas fa-palette"&gt;&lt;/i&gt; Visual Editor</strong> button in the header.</p>
                <ul>
                    <li><strong>Best for:</strong> Fine-tuning layout and spacing, reordering elements, changing text directly, or replacing images. It gives you the tactile feel of a traditional website builder.</li>
                    <li><strong>How:</strong> The editor loads your site in an editable canvas. You can drag and drop new components from the left-hand panel (like sections, headings, buttons) or click on any existing element to modify its properties (like color, font size, padding) in the right-hand style manager. Changes are saved back to your project's code when you exit.</li>
                </ul>

                <h2>3. The IDE (Code Editor)</h2>
                <p>When you need absolute precision or want to work directly with the code, the IDE is the ultimate tool. Access it via the <strong>&lt;i class="fas fa-code"&gt;&lt;/i&gt; Code Editor</strong> button.</p>
                 <ul>
                    <li><strong>Best for:</strong> Fixing specific bugs, implementing custom JavaScript logic, fine-tuning complex CSS animations, or cleaning up the code for production.</li>
                    <li><strong>How:</strong> The V2 IDE is a multi-file editor with tabs for <code>index.html</code>, <code>style.css</code>, and <code>script.js</code>. You can edit directly and use the integrated **Contextual AI**. Simply highlight a block of code, and a magic wand icon will appear. Click it to ask the AI to refactor, debug, or explain just that specific selection.</li>
                </ul>

                <h3>Workflow Example:</h3>
                <p>A typical V2 workflow might look like this:</p>
                <ol>
                    <li>Use the <strong>AI Chat</strong> to generate the initial website structure.</li>
                    <li>Switch to the <strong>Visual Editor</strong> to tweak the spacing and replace placeholder images.</li>
                    <li>Jump into the <strong>IDE</strong> to add a custom piece of JavaScript for a unique interaction.</li>
                    <li>Return to the <strong>AI Chat</strong> to ask for one final content rewrite.</li>
                </ol>
                <p>By leveraging all three tools, you can work faster and more effectively than ever before.</p>
            ` 
        },
       'code-editor': { 
            title: 'The Multi-File IDE', 
            content: `
                <h1>The Multi-File IDE</h1>
                <p>Stylo AI V2 replaces the simple code modal with a powerful, VS Code-inspired Integrated Development Environment (IDE). This professional-grade editor gives you granular control over your project's files and integrates groundbreaking AI features directly into your coding workflow.</p>
                <h2>IDE Interface</h2>
                <p>Accessed via the <strong>&lt;i class="fas fa-code"&gt;&lt;/i&gt; Code Editor</strong> button, the IDE presents a familiar interface:</p>
                <ul>
                    <li><strong>File Explorer (Left):</strong> A sidebar showing all the files in your project (e.g., <code>index.html</code>, <code>style.css</code>, <code>script.js</code>). You can create new files or delete existing ones from here.</li>
                    <li><strong>Tab Bar (Top):</strong> Open files appear as tabs, allowing you to quickly switch between them.</li>
                    <li><strong>Main Editor Pane:</strong> A high-performance CodeMirror editor with syntax highlighting, line numbers, and auto-completion.</li>
                    <li><strong>Action Bar:</strong> Contains buttons to Run (update the main preview), Save, and Download the project as a .zip file.</li>
                </ul>
                <p>When you first open the IDE, Stylo AI automatically deconstructs your single-file HTML into separate, organized <code>.html</code>, <code>.css</code>, and <code>.js</code> files for a clean development experience.</p>
                
                <h2>Contextual AI Editing: The Ultimate Co-Pilot</h2>
                <p>The standout feature of the new IDE is its contextual AI assistance. This tool allows you to perform AI operations on specific pieces of code, rather than the entire document.</p>
                <h3>How to Use It:</h3>
                <ol>
                    <li><strong>Select Code:</strong> Highlight any block of code in the editor—a CSS rule, a JavaScript function, or an HTML element.</li>
                    <li><strong>Summon the AI:</strong> A small <strong>&lt;i class="fas fa-wand-sparkles"&gt;&lt;/i&gt; magic wand icon</strong> will appear near your selection. Click it.</li>
                    <li><strong>Issue a Command:</strong> An input window will pop up. Type a specific instruction for the AI.</li>
                    <li><strong>Apply the Patch:</strong> The AI will generate a replacement for your selection. You can then apply this "patch" with a single click.</li>
                </ol>
                <h3>The Floating Magic Wand</h3>
<p>Unlike traditional AI editors that suggest code for the whole file, Stylo's <strong>Contextual Widget</strong> acts like a surgical tool. When you select code, a floating wand icon appears precisely at your cursor position.</p>
<ul>
    <li><strong>Surgical Precision:</strong> The AI only sees and modifies what you highlight. This prevents it from breaking other working parts of your file.</li>
    <li><strong>Instant Diff:</strong> Once you issue a command (e.g., "Make this function async"), the AI generates a 'patch'. You can review it and click "Apply" to swap the old code with the new one instantly.</li>
    <li><strong>Language Aware:</strong> The widget knows if you are editing HTML, CSS, or JS and adapts its logic accordingly.</li>
</ul>
<p><small><em>Pro Tip: Use this to fix specific CSS alignment issues without the AI changing your entire layout.</em></small></p>
                <h3>Powerful Use Cases:</h3>
                <ul>
                    <li><strong>Refactoring:</strong> Select a messy function and type "Refactor this for clarity and performance."</li>
                    <li><strong>Debugging:</strong> Highlight a broken piece of code and ask, "Find and fix the error here."</li>
                    <li><strong>Translation:</strong> Select a block of standard CSS and instruct, "Convert this to Tailwind CSS classes."</li>
                    <li><strong>Explanation:</strong> Select a complex regular expression or function and ask, "Explain what this code does in simple terms."</li>
                </ul>
                <p>This feature transforms the AI from a generator into a true pair programmer, helping you understand, improve, and debug code with unprecedented speed and precision.</p>
            ` 
        },
        'saving-projects': { 
            title: 'Saving & Managing Projects', 
            content: `
                <h1>Saving & Managing Projects</h1>
                <p>Your projects are your most valuable assets in Stylo AI. Our project management system is designed to be simple, robust, and accessible from anywhere in the editor.</p>
                
                <h2>Saving and Updating</h2>
                <p>When a project is loaded, the <strong>&lt;i class="fas fa-save"&gt;&lt;/i&gt; Save</strong> button in the main header toolbar is your primary tool for persisting work. On the first save, it will confirm the project name. On subsequent saves, it will simply update the project with your latest changes. We recommend saving frequently, especially after significant AI generations or manual edits.</p>
                
                <h2>The Project Selector Dropdown</h2>
                <p>The main hub for managing and navigating your projects is the dropdown menu in the top-left of the header. This menu provides a comprehensive, searchable list of all projects you have access to.</p>
                <h3>Views:</h3>
                <p>Your projects are automatically categorized:</p>
                <ul>
                    <li><strong>Mine:</strong> Projects you created and own.</li>
                    <li><strong>Shared:</strong> Projects that other users have invited you to collaborate on.</li>
                </ul>
                <p>Icons next to each project indicate if it's a personal project or part of a shared Workspace.</p>
                <h3>Actions:</h3>
                <ul>
                    <li><strong>Clicking a Project:</strong> Instantly loads the selected project into the editor.</li>
                    <li><strong>Delete (Trash Icon):</strong> For projects you own, you can quickly delete them directly from the dropdown.</li>
                    <li><strong>Create New Project:</strong> A shortcut at the bottom of the list to start a new project.</li>
                </ul>
                <p>You can also view your projects in a more visual card-based layout on the Stylo AI home page, which offers the same management capabilities.</p>
            ` 
        },
        'version-history': { 
            title: 'Using Version History', 
            content: `
                <h1>Using Version History</h1>
                <p>Stylo AI's Version History is a powerful safety net that gives you the freedom to experiment without fear of losing your work. It automatically captures snapshots of your project at key moments, allowing you to review, preview, and restore previous versions of your website with ease. This feature is indispensable for tracking your design evolution and recovering from unintended changes.</p>
                <h2>How Versions are Created</h2>
                <p>Versions are created automatically at two key moments:</p>
                <ol>
                    <li><strong>After an AI Edit:</strong> Immediately after the AI successfully completes a generation or refinement, a new version is saved with the action "AI Edit." This ensures that every creative step taken by the AI is recorded.</li>
                    <li><strong>On a Manual Save:</strong> Whenever you click the main <strong>&lt;i class="fas fa-save"&gt;&lt;/i&gt; Save</strong> button, a version is saved with the action "Manual Save." This is useful for creating stable checkpoints in your development process.</li>
                </ol>
                <p>Each saved version contains the complete project state at that specific moment, along with a timestamp and the user who triggered the save.</p>
                <h2>Accessing and Restoring Versions</h2>
                <p>For any loaded project, click the <strong>&lt;i class="fas fa-history"&gt;&lt;/i&gt; Version History</strong> button in the header toolbar. This opens the Version History modal, which presents a two-pane interface:</p>
                <ul>
                    <li><strong>Left Pane (Versions List):</strong> A chronological list of all saved versions for the current project.</li>
                    <li><strong>Right Pane (Preview):</strong> When you click on an item in the list, a full, interactive preview of that version of your website is rendered here.</li>
                </ul>
                <p>If you decide that a previous version was better, simply select it and click the <strong>"Restore This Version"</strong> button. Upon confirmation, Stylo AI will replace the current state of your project with the selected version. A new version entry, labeled "Restored," is automatically created, so even your act of restoring is safely recorded.</p>
            ` 
        },
        'deployment': { 
            title: 'One-Click Deployment', 
            content: `
                <h1>One-Click Deployment</h1>
                <p>Stylo AI removes the complexities of hosting with our integrated one-click deployment system. You can take your creation from the editor to a live, publicly accessible URL in seconds, with zero configuration required.</p>
                
                <h2>The Deployment Workflow</h2>
                <p>The deployment controls are conveniently located in the main header toolbar whenever you have a project loaded.</p>
                <ul>
                    <li><strong>First-Time Deployment:</strong> After saving your project, click the blue <strong>&lt;i class="fas fa-rocket"&gt;&lt;/i&gt; Deploy</strong> button. Our service automatically provisions a secure hosting environment and pushes your site live.</li>
                    <li><strong>Visiting Your Site:</strong> Once deployment is complete, the button group updates. A green <strong>&lt;i class="fas fa-external-link-alt"&gt;&lt;/i&gt; Visit</strong> button will appear. Click this to open your live website in a new tab.</li>
                    <li><strong>Re-deploying Updates:</strong> After making more changes and saving your project, the site is marked as "dirty" (having unpublished changes). The <strong>&lt;i class="fas fa-sync-alt"&gt;&lt;/i&gt; Redeploy</strong> button will be highlighted. Click it to push your latest updates to the same live URL.</li>
                </ul>
                <p>All our deployments are automatically secured with HTTPS, ensuring a professional and secure experience for your visitors.</p>
            ` 
        },
        'project-images': { 
            title: 'Managing Project Images', 
            content: `
                <h1>Managing Project Images</h1>
                <p>Images are a critical component of modern web design, and Stylo AI provides a robust, project-specific system for uploading and managing your visual assets. By keeping images tied to a project, we ensure that your assets are organized, secure, and easily accessible to the AI during the generation process.</p>
                <h2>The Project Images Manager</h2>
                <p>When you have a project loaded, you can access its dedicated image manager by clicking the <strong>&lt;i class="fas fa-images"&gt;&lt;/i&gt; Project Images</strong> icon in the Workspace header. This opens a modal that serves as the central library for all images associated with the current project.</p>
                <h3>Uploading Images</h3>
                <p>To add images, click the <strong>&lt;i class="fas fa-upload"&gt;&lt;/i&gt; "Upload New Images"</strong> button. This will open your system's file browser, allowing you to select one or multiple image files. We support all standard web formats (JPG, PNG, GIF, WebP). Once you confirm your selection, the upload process begins immediately. Each image is securely uploaded to our Cloudinary-powered cloud storage. During this process, several things happen:</p>
                <ul>
                    <li>The image is stored in a high-availability, globally distributed content delivery network (CDN) for fast loading times anywhere in the world.</li>
                    <li>A unique, secure URL is generated for each image.</li>
                    <li>A record of the image, including its name and URL, is saved in a dedicated sub-collection within your project's document in our database.</li>
                </ul>
                <p>The image cards will appear in the manager as they successfully upload. You can upload as many images as you need for your project.</p>
                <h2>Managing Your Images</h2>
                <p>The image manager displays all of your project's images in a grid. Each image is represented by a card showing a thumbnail preview and its name.</p>
                <ul>
                    <li><strong>Renaming Images:</strong> You can edit an image's name directly in the text area on its card. The name is important, as it's how you will refer to the image when prompting the AI (e.g., via \`@mention\`). Use clear, descriptive names like "hero-background.jpg" or "logo-dark.png". Changes are saved automatically as you type.</li>
                    <li><strong>Context Menu:</strong> Clicking the three-dot menu icon on an image card reveals additional options, such as "Remove from Project." Deleting an image will remove it from your project's library, but please note that this does not currently delete the file from cloud storage.</li>
                </ul>
                <h2>Using Images with the AI</h2>
                <p>Once your images are uploaded, you can instruct the AI to use them in your designs. The most effective way to do this is with the <strong>@mention</strong> feature in the AI chat. For example:</p>
                <pre><code>"Set the hero section's background image to my uploaded image @hero-background.jpg"
"In the about section, add an image of the founder, @jane-doe-portrait.png, and make it circular."</code></pre>
                <p>This direct reference system ensures the AI uses your exact uploaded image, rather than searching for a generic placeholder. You can learn more about this in the "Using @ and # Mentions" section of the documentation. This integrated asset pipeline—from upload to AI-powered placement—is designed to make working with images seamless and intuitive.</p>
            ` 
        },
        'project-databases': { 
            title: 'Working with Project Databases', 
            content: `
                <h1>Working with Project Databases</h1>
                <p>Stylo AI goes beyond static websites by providing a powerful, integrated database system for each of your projects. This allows you to capture user input, manage e-commerce products, and create dynamic, data-driven experiences. Our database is powered by Google Firestore, offering a secure, scalable, and real-time NoSQL solution, all managed through a user-friendly interface.</p>
                <h2>What are Project Databases?</h2>
                <p>In Stylo AI, a "database" is referred to as a **Collection**. Each project can have multiple collections. A collection is like a folder that holds individual entries, which are called **Documents** or **Submissions**. For example, a "Leads" collection would hold a document for each person who fills out your contact form. A "Products" collection would hold a document for each item you're selling.</p>
                <p>This system is automatically configured by the AI when it generates a site with forms or e-commerce features. For example, if you ask for a contact form, the AI will automatically:</p>
                <ol>
                    <li>Create a new collection named "Leads" for your project if one doesn't already exist.</li>
                    <li>Generate the HTML for the form.</li>
                    <li>Embed a hidden input in the form that links it directly to the "Leads" collection ID.</li>
                    <li>Include the necessary JavaScript to capture the form data and save it as a new document in that collection upon submission.</li>
                </ol>
                <h2>The Firestore Browser</h2>
                <p>You can view and manage your data by clicking the <strong>&lt;i class="fas fa-database"&gt;&lt;/i&gt; Project Databases</strong> icon in the Workspace header. This opens our custom Firestore Browser, a three-pane interface designed for intuitive data exploration.</p>
                <ul>
                    <li><strong>Pane 1: Collections:</strong> This leftmost pane lists all the database collections that have been created for the current project (e.g., "Leads," "Products," "Orders"). You can also manually create a new collection using the "+" button.</li>
                    <li><strong>Pane 2: Documents/Submissions:</strong> When you select a collection from the first pane, this middle pane populates with a list of all the individual documents within it, sorted by creation date. For a "Leads" collection, each item here would represent a single form submission.</li>
                    <li><strong>Pane 3: Data Viewer:</strong> When you select a document from the second pane, this rightmost pane displays the actual data contained within that document. It's formatted in a clean, readable key-value layout, allowing you to easily see the information submitted by a user or the details of a product.</li>
                </ul>
                <h2>Using Databases with the AI</h2>
                <p>The most powerful way to interact with your databases is through the AI Chat, using the <strong>#mention</strong> feature. This allows you to explicitly tell the AI which collection a form should be connected to.</p>
                <pre><code>"Create a new landing page with a newsletter signup form that saves submissions to the #Newsletter-Subscribers collection."
"Add an admin panel to my e-commerce site with a form to add new products. The form should submit to my #Products database."</code></pre>
                <p>When you use a #mention, Stylo AI ensures the generated form is correctly configured to send data to the specified collection. This gives you precise control over your application's data flow, enabling you to build complex, multi-form websites with ease. To learn more, see the "Using @ and # Mentions" guide.</p>
            ` 
        },
        'using-mentions': { 
            title: 'Using @ and # Mentions', 
            content: `
                <h1>Using @ and # Mentions</h1>
                <p>The @ and # mention system is a powerful, IDE-like feature within the Stylo AI Chat that gives you precise control over your project's assets and data. By using these simple prefixes, you can eliminate ambiguity and explicitly instruct the AI on which images and databases to use, ensuring your generated code is perfectly connected to your project's resources.</p>
                <h2>@mention for Images</h2>
                <p>The \`@\` symbol is used to reference images that you have uploaded to the current project's Image Manager. This is the definitive way to place your own assets into a design.</p>
                <h3>How it Works:</h3>
                <ol>
                    <li>First, ensure you have uploaded the desired image via the <strong>&lt;i class="fas fa-images"&gt;&lt;/i&gt; Project Images</strong> manager and given it a clear, memorable name (e.g., "company-logo.png").</li>
                    <li>In the AI Chat, when writing a prompt that involves an image, type the \`@\` symbol. A popup will appear, listing all the images in your project.</li>
                    <li>You can either click on the desired image from the list or continue typing its name to filter the list.</li>
                    <li>When you select an image, it will be inserted into your prompt with a unique numerical marker, for example: \`company-logo.png [1]\`.</li>
                </ol>
                <p>When the AI receives a prompt with this mention, it gets a special instruction: "For the asset mentioned as \`company-logo.png [1]\`, you MUST use this exact URL: \`https://...\`". This guarantees the AI uses your specific uploaded asset instead of a generic placeholder.</p>
                <pre><code>// Example Prompts using @mentions
"Create a header with my company's logo, @company-logo.png [1], on the left."
"Set the background of the main hero section to the image @hero-background.jpg [2]."
"Add a three-column grid of team member photos using @team-member-1.png [3], @team-member-2.png [4], and @team-member-3.png [5]."</code></pre>
                
                <h2>#mention for Databases (Collections)</h2>
                <p>The \`#\` symbol is used to reference your project's databases (Collections). This is crucial for telling the AI where form data should be saved.</p>
                <h3>How it Works:</h3>
                <ol>
                    <li>Databases are often created automatically by the AI when you request forms, but you can also create them manually in the <strong>&lt;i class="fas fa-database"&gt;&lt;/i&gt; Project Databases</strong> browser.</li>
                    <li>In the AI Chat, when writing a prompt that includes a form, type the \`#\` symbol. A popup will appear, listing all available collections for your project.</li>
                    <li>Select the desired collection. It will be inserted into your prompt with a marker, like: \`Leads [1]\`.</li>
                </ol>
                <p>This tells the AI to generate a form that includes a hidden input field containing the unique ID of the "Leads" collection. The pre-built JavaScript engine then uses this ID to save the form submission to the correct location.</p>
                 <pre><code>// Example Prompts using #mentions
"Add a contact form to the footer that submits to the #Leads [1] database."
"Create a registration page with a form for new users. It should save the user data to my #Users [2] collection."
"Build a product submission form for the admin panel that connects to the #Products [3] database."</code></pre>
                <p>By mastering @ and # mentions, you elevate your prompting from simple descriptions to precise, technical instructions. This system bridges the gap between conversational commands and the specific implementation details of your project, giving you an unprecedented level of control over the AI's output.</p>
            ` 
        },
        'form-handling': { 
            title: 'Advanced Form Handling', 
            content: `
                <h1>Advanced Form Handling</h1>
                <p>Stylo AI's form handling capabilities are designed to be both incredibly simple to use and remarkably powerful. Every website generated by the AI that includes a form is automatically equipped with a robust, client-side JavaScript engine that handles validation, data serialization, file uploads, and submission to the correct Project Database. This section dives into the mechanics of this system.</p>
                <h2>The Unified Data Handling Pattern</h2>
                <p>When the AI generates a form, it follows a strict, non-negotiable pattern to ensure functionality. This is the "Unified Data Handling Pattern."</p>
                <ol>
                    <li><strong>The Hidden Input:</strong> Every form intended to save data MUST include a special hidden input field: \`&lt;input type="hidden" name="_collectionId" value="..."&gt;\`. The \`value\` of this input is the unique ID of the Project Database (Collection) where submissions should be stored. This ID is automatically inserted by the AI, especially when you use a #mention in your prompt.</li>
                    <li><strong>The JavaScript Backbone:</strong> A comprehensive, pre-written JavaScript module is embedded in your site. This module contains a universal \`handleFormSubmit\` function that automatically attaches an event listener to every \`&lt;form&gt;\` element on the page.</li>
                </ol>
                <h2>The Submission Process</h2>
                <p>When a user clicks a form's submit button, the following sequence is executed by the built-in JavaScript engine:</p>
                <ol>
                    <li>\`event.preventDefault()\` is called to stop the default browser submission.</li>
                    <li>The engine finds the \`_collectionId\` hidden input to determine the destination database. If it's missing, the submission is halted with an error.</li>
                    <li>The submit button is disabled and its text is changed to "Submitting..." to provide user feedback.</li>
                    <li>A \`FormData\` object is created to gather all values from the form's fields.</li>
                    <li>The engine iterates through the form data. If it encounters a file input with a selected file, it initiates a separate, direct-to-cloud upload process. The file is sent to our secure Cloudinary storage, and the resulting URL is stored.</li>
                    <li>All other form values (and the file URL from the previous step) are compiled into a single JSON object.</li>
                    <li>This JSON object is saved as a new document within the 'submissions' sub-collection of the specified Project Database in Firestore. The document is also timestamped.</li>
                    <li>If the submission is successful, an alert is shown to the user, the form is reset, and the submit button is re-enabled.</li>
                </ol>
                <h2>Handling File Uploads</h2>
                <p>Stylo AI makes handling file uploads trivial. Simply ask the AI to include a file input in your form:</p>
                <pre><code>"Create a job application form with fields for name, email, and a file upload for a resume."</code></pre>
                <p>The AI will generate \`&lt;input type="file" name="resume"&gt;\`. The backend JavaScript engine automatically detects this field. When the user selects a file, the engine will handle the upload to Cloudinary and save the file's secure URL to your database as part of the form submission data. You don't need to write any extra code to handle this complex process. In your database, the submission will look something like this:</p>
                <pre><code>{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "resume": {
    "name": "Jane_Doe_Resume.pdf",
    "url": "https://res.cloudinary.com/..."
  }
}</code></pre>
                <p>This powerful, automated system means you can create complex, data-driven applications with features like user profile picture uploads, document submissions, and more, simply by asking for them in plain English.</p>
            ` 
        },
        'creating-ecommerce': { 
            title: 'Building E-commerce Sites', 
            content: `
                <h1>Building E-commerce Sites</h1>
                <p>Stylo AI includes a specialized blueprint for creating full-featured, client-side e-commerce websites. By simply asking for a "shop" or "e-commerce site," you can generate a complete solution with product listings, a shopping cart, and an admin panel for product management. This entire system is powered by the same Project Database features used for form handling, providing a seamless and integrated experience.</p>
                <h2>The E-commerce Blueprint</h2>
                <p>When you request an e-commerce site, the AI automatically performs several setup actions:</p>
                <ol>
                    <li>It creates two essential Project Databases (Collections) if they don't already exist: <strong>"Products"</strong> and <strong>"Orders"</strong>.</li>
                    <li>It generates a multi-section website that typically includes:
                        <ul>
                            <li>A public-facing product grid to display your items.</li>
                            <li>A shopping cart, often implemented as a modal, to show selected items and the total price.</li>
                            <li>A checkout form to collect customer information and submit orders.</li>
                            <li>A password-protected or hidden "Admin Panel" section containing a form to add new products.</li>
                        </ul>
                    </li>
                    <li>It embeds an advanced version of the "Unified Data Handling" JavaScript engine, which includes functions specifically for managing a shopping cart and rendering products.</li>
                </ol>
                <h2>Managing Products</h2>
                <p>Products are managed through the "Products" database. The easiest way to add them is through the AI-generated Admin Panel.</p>
                <h3>The "Add Product" Form:</h3>
                <p>The form in the Admin Panel is automatically connected to your "Products" collection. It will typically include fields for:</p>
                <ul>
                    <li>Product Name (text input)</li>
                    <li>Price (number input)</li>
                    <li>Description (textarea)</li>
                    <li>Image (file input)</li>
                </ul>
                <p>When you fill out this form and click "Submit," the data, including the uploaded image URL from Cloudinary, is saved as a new document in your "Products" database. The public-facing product grid, which reads from this same database, will update in real-time to display the new item.</p>
                <h2>How the Shopping Cart Works</h2>
                <p>The shopping cart is a client-side feature managed entirely within the user's browser using JavaScript and Local Storage. This makes it fast and responsive.</p>
                <ul>
                    <li><strong>Adding Items:</strong> Each product card in the public grid has an "Add to Cart" button. The embedded JavaScript listens for clicks on these buttons, reads the product's data (ID, name, price), and adds it to a JavaScript array representing the cart.</li>
                    <li><strong>Persistence:</strong> After any change (adding an item, updating quantity), the cart array is saved to the browser's Local Storage. This means if the user refreshes the page or closes the tab and comes back, their cart contents will still be there.</li>
                    <li><strong>Rendering the Cart:</strong> The cart modal reads from this local array to display the items, quantities, and total price. Functions are included to handle quantity changes and item removal.</li>
                </ul>
                <h2>Processing Orders</h2>
                <p>The final step is the checkout. The checkout form gathers customer details (like name, address, etc.) and, crucially, includes a hidden field containing a JSON string of the current cart's contents. When the user submits the checkout form, it is handled by the same \`handleFormSubmit\` engine. The entire order, including the customer's details and the list of products they purchased, is saved as a single document in your "Orders" database. This provides you with a complete record of every transaction, which you can view and manage through the Firestore Browser in Stylo AI.</p>
            ` 
        },
        // =========================================================================
        //  NEW SECTION: WORKSPACES & COLLABORATION
        // =========================================================================
        'workspaces-and-teams': {
            title: 'Workspaces & Teams',
            content: `
                <h1>Workspaces & Teams</h1>
                <p>Stylo AI V2 introduces Workspaces, a powerful feature for organizing projects and collaborating with your team. This moves beyond single-user projects to a shared environment with centralized management.</p>
                <h2>Personal vs. Workspace Projects</h2>
                <ul>
                    <li><strong>Personal Projects:</strong> By default, any project you create is a Personal Project. It belongs only to you and is not visible to anyone else unless you share it individually.</li>
                    <li><strong>Workspace Projects:</strong> A Workspace is a shared environment for your team. When you create a project within a Workspace, all members of that Workspace automatically have access to it, according to their assigned roles. This is the ideal way to manage company or agency projects.</li>
                </ul>
                <h2>Creating and Managing Workspaces</h2>
                <p>All team management is handled in your <strong>Profile Dashboard</strong> under the "Teams & Collab" section.</p>
                <h3>Creating a Workspace:</h3>
                <ol>
                    <li>Navigate to your Profile -> Teams & Collab.</li>
                    <li>Click the "Create Team" button.</li>
                    <li>Give your Workspace a name (e.g., "Acme Design Agency") and an optional description.</li>
                </ol>
                <p>You are now the Owner of this Workspace. You can create as many Workspaces as your plan allows.</p>
                <h3>Inviting Members:</h3>
                <p>Once a Workspace is created, click the "Manage" button on its card. In the management modal, you can invite new members by entering their email address. They will receive an invitation within their Stylo AI account to join your team. You can view all members and their roles from this modal.</p>
                <h3>Linking Projects to a Workspace:</h3>
                <p>When you create a new project in the main editor, the "New Project" modal will now include a dropdown allowing you to assign the project to either your Personal space or one of your Workspaces.</p>
            `
        },
        'sharing-projects': { 
            title: 'Sharing & Invites', 
            content: `
                <h1>Sharing Projects & Invites</h1>
                <p>Stylo AI V2 offers two primary ways to collaborate: by inviting users to a shared Workspace (recommended for teams) or by sharing individual projects.</p>
                
                <h2>Inviting to a Workspace</h2>
                <p>This is the most efficient way to manage team collaboration. When you invite a user to a Workspace, they gain access to all projects within it.</p>
                <ol>
                    <li>Go to your Profile -> Teams & Collab.</li>
                    <li>Click "Manage" on the desired Workspace.</li>
                    <li>In the "Members" tab, enter the email of the user you wish to invite and click "Send Invite."</li>
                </ol>
                <p>The invited user will see a "Pending Invitation" card in their own Teams & Collab dashboard, where they can accept or decline.</p>

                <h2>Sharing an Individual Project</h2>
                <p>You can also share a single project without adding the user to a full Workspace. This is ideal for collaborating with external clients or freelancers on a specific task.</p>
                <ol>
                    <li>Load the project you want to share in the editor.</li>
                    <li>Click the <strong>&lt;i class="fas fa-user-plus"&gt;&lt;/i&gt; Share</strong> button in the header toolbar.</li>
                    <li>In the modal, enter the user's email, assign them a role (Owner, Editor, or Viewer), and send the invite.</li>
                </ol>
                <p>The project will then appear in the invited user's "Shared with Me" list in their project dropdown.</p>
            ` 
        },
        'user-roles': { 
            title: 'User Roles & Permissions', 
            content: `
                <h1>User Roles & Permissions</h1>
                <p>Stylo AI employs a role-based permission system to ensure safe and effective collaboration. Roles can be assigned when inviting a user to a Workspace or an individual project.</p>
                
                <h2>1. Owner</h2>
                <p>The creator of a project or Workspace. This role has the highest level of administrative control.</p>
                <ul>
                    <li><strong>Permissions:</strong> Full edit access, project management (save, deploy, version history), collaboration management (invite, remove members), and project/workspace deletion.</li>
                </ul>
                
                <h2>2. Editor</h2>
                <p>A trusted team member with full creative control but limited administrative power.</p>
                 <ul>
                    <li><strong>Permissions:</strong> Full edit access (AI Chat, IDE, Visual Editor), can save/update the project, and create new versions.</li>
                    <li><strong>Restrictions:</strong> Cannot delete the project/workspace or manage team members.</li>
                </ul>

                <h2>3. Viewer</h2>
                <p>A read-only role, perfect for sharing progress with clients or stakeholders for feedback.</p>
                <ul>
                    <li><strong>Permissions:</strong> Can load the project, see the live preview, and inspect the code in a read-only state.</li>
                    <li><strong>Restrictions:</strong> All editing capabilities (AI Chat, editors, saving, deploying) are disabled.</li>
                </ul>
            ` 
        },
        'real-time-editing': { 
            title: 'Real-time Collaborative Editing', 
            content: `
                <h1>Real-time Collaborative Editing</h1>
                <p>Stylo AI's collaboration features are enhanced by real-time updates and presence indicators, making it feel like you're working in the same room as your team. Our system is designed to prevent conflicts and keep everyone in sync.</p>
                
                <h2>Live Data Syncing</h2>
                <p>When you load a shared project or a project in a Workspace, your editor subscribes to live updates from the database. If a collaborator saves an update, your live preview and chat history will automatically refresh to reflect the latest state of the project, ensuring you are never working on an outdated version.</p>
                
                <h2>Presence Indicators</h2>
                <p>Knowing who is currently active on a project is crucial. In the Workspace header, you will see the avatars of all users who are currently viewing or editing the same project as you. Their avatars will be highlighted, giving you an at-a-glance view of your active team.</p>
                
                <h2>Editing Status</h2>
                <p>To prevent two users from accidentally overwriting each other's work by running AI commands at the same time, we have an "is editing" status. When a user sends a prompt to the AI, a status message briefly appears for all other collaborators, saying "[User Name] is editing...". This temporarily locks the "Generate" button for other users until the current operation is complete, ensuring data integrity and preventing conflicting commands.</p>
            ` 
        },
         // =========================================================================
        //  NEW SECTION: ADVANCED TOOLS
        // =========================================================================
        'visual-editor': {
            title: 'The Visual "Drag & Drop" Editor',
            content: `
                <h1>The Visual "Drag & Drop" Editor</h1>
                <p>For moments when you want more tactile, hands-on control over your layout, Stylo AI V2 includes a powerful Visual Editor. This tool provides a traditional "drag and drop" website builder experience, allowing you to manipulate elements directly on a canvas.</p>
                
                <h2>Accessing the Visual Editor</h2>
                <p>When you have a project loaded, click the <strong>&lt;i class="fas fa-palette"&gt;&lt;/i&gt; Visual Editor</strong> button in the main header toolbar. Your current website will be loaded into a new, full-screen editor interface powered by GrapesJS.</p>
                
                <h2>Interface Overview</h2>
                <ul>
                    <li><strong>Canvas (Center):</strong> A live, editable version of your website. You can click directly on any element (text, image, button) to select it.</li>
                    <li><strong>Blocks Panel (Left):</strong> A library of pre-built components (like Sections, 2-Column Grids, Headings, Buttons) that you can drag directly onto the canvas to add new content.</li>
                    <li><strong>Style Manager (Left):</strong> When an element is selected on the canvas, this panel allows you to modify its properties visually. You can change colors, fonts, spacing (padding/margin), borders, and more without writing any CSS.</li>
                    <li><strong>Layers Panel (Left):</strong> A hierarchical tree view of all the elements on your page. This is useful for selecting elements that are nested deep within others.</li>
                    <li><strong>Top Toolbar:</strong> Contains device previews (desktop, tablet, mobile), undo/redo buttons, and the crucial "Save Changes" and "Close" buttons.</li>
                </ul>

                <h2>Workflow</h2>
                <p>The Visual Editor is perfect for fine-tuning the AI's output.</p>
                <ol>
                    <li>Generate a website section using the AI Chat.</li>
                    <li>Open the Visual Editor to make precise adjustments. For example, you might click on a heading and increase its font size using the Style Manager, or drag a button to a different column.</li>
                    <li>Once you are satisfied with your visual tweaks, click the <strong>&lt;i class="fas fa-save"&gt;&lt;/i&gt; Save Changes</strong> button.</li>
                    <li>This will update your project's code with the changes you made and return you to the main editor.</li>
                </ol>
                <p>This hybrid workflow gives you the best of both worlds: the incredible speed of AI generation for the heavy lifting, and the precise, pixel-perfect control of a visual builder for the finishing touches.</p>
            `
        },
        'project-wizard': {
            title: 'The Project Wizard',
            content: `
                <h1>The Project Wizard</h1>
                <p>To help you get the best possible results from the very first generation, Stylo AI V2 introduces the Project Wizard. This is an interactive questionnaire that launches whenever you create a new project.</p>
                
                <h2>How It Works</h2>
                <p>Instead of leaving you to think of a detailed prompt from scratch, the wizard guides you through a series of simple questions about your project. It will ask about:</p>
                <ul>
                    <li><strong>The Project Type:</strong> Are you building a Portfolio, a Business Site, an E-commerce store?</li>
                    <li><strong>Your Brand Name:</strong> What is the project or company called?</li>
                    <li><strong>Design Aesthetic:</strong> Do you prefer a Minimalist, Bold, Corporate, or Dark Mode style?</li>
                    <li><strong>Color Preferences:</strong> Do you have any specific brand colors?</li>
                    <li><strong>Key Features:</strong> Do you need a contact form, a gallery, or a map?</li>
                </ul>
                <p>You can also upload your logo directly during this process.</p>
                
                <h2>The Master Prompt</h2>
                <p>As you answer these questions, the wizard is constructing a comprehensive, highly-detailed "master prompt" behind the scenes. Once you complete the questionnaire, this master prompt is automatically submitted to the AI.</p>
                <p>Because this prompt is so detailed and structured in a way the AI understands best, the resulting website is often 90% of the way to your final vision on the very first try. It significantly reduces the amount of refinement needed and is the recommended way for all users to start a new project.</p>
                
                <h2>Skipping the Wizard</h2>
                <p>If you are an advanced user and prefer to write your own initial prompt, you can simply close the wizard at any time to return to the standard editor interface.</p>
            `
        },
         'pricing-and-billing': {
            title: 'Pricing & Billing',
            content: `
                <h1>Pricing & Billing</h1>
                <p>Stylo AI offers a range of flexible plans designed to scale with your needs, from individual hobbyists to large collaborative teams. You can manage your subscription at any time from your <strong>Profile Dashboard</strong> under the "Pricing & Billing" section.</p>
                
                <h2>Our Plans</h2>
                <ul>
                    <li><strong>Free:</strong> Perfect for getting started. Includes access to core AI features with limits on the number of projects, database collections, and deployments you can have.</li>
                    <li><strong>Startup:</strong> For professionals and freelancers. Increases all limits and unlocks key features like Code Export.</li>
                    <li><strong>Pro:</strong> For power users who need higher limits and access to our most advanced AI models and features.</li>
                    <li><strong>Business:</strong> The ultimate plan for agencies and companies. Unlocks full team collaboration features, unlimited resources, and priority support.</li>
                </ul>
                <p>A detailed breakdown of the features and limits for each plan is available on the pricing page.</p>

                <h2>Upgrading Your Plan</h2>
                <p>To upgrade, simply navigate to the "Pricing & Billing" section in your profile and click the "Upgrade" button on your desired plan. We use <strong>Razorpay</strong>, a secure and trusted payment gateway, to handle all transactions. The upgrade will be applied to your account instantly upon successful payment.</p>

                <h2>Managing Your Subscription</h2>
                <p>Your billing dashboard provides a clear overview of your current plan, your next billing date, and access to your payment history and invoices. From here, you can upgrade, downgrade, or cancel your subscription at any time. Changes to your plan will take effect at the end of your current billing cycle.</p>
                <div style="margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), transparent); border: 2px dashed var(--primary-color); border-radius: 12px;">
    <h2 style="margin-top:0; color: var(--primary-color);">👑 The Elite Bird Promotion</h2>
    <p>To celebrate the launch of Stylo AI V2, we are offering <strong>FREE Lifetime Elite Business Access</strong> to our first 20 users. This is a first-come, first-served opportunity to unlock every premium feature without ever paying a subscription fee.</p>
    <h3>How to Claim:</h3>
    <ol>
        <li>Go to your <strong>Profile Dashboard</strong>.</li>
        <li>Navigate to the <strong>Account</strong> section.</li>
        <li>Look for the "Early Bird Promotion" card. If slots are available, enter your professional title and click <strong>"Claim Free Elite Access"</strong>.</li>
    </ol>
    <p><em>Note: This offer requires no credit card and grants you unlimited projects, team collaboration, and advanced AI models for life.</em></p>
</div>
            `
        },
        'custom-prompts': { 
            title: 'Customizing AI Personas', 
            content: `
                <h1>Customizing AI Personas</h1>
                <p>The AI Persona feature is an advanced tool that allows you to provide high-level, persistent instructions to the AI for the duration of a project session. By setting a persona, you can guide the AI's "creative direction," influencing the style of its code, the tone of its copy, and its overall approach to design problems. This is akin to giving a human designer a creative brief before they start working.</p>
                <h2>How to Set a Persona</h2>
                <p>In the Control Panel, you will find an accordion section labeled "1. Train AI (AI Persona)." Clicking this will reveal a textarea where you can input your custom instructions. This persona will be prepended to every prompt you send to the AI for the current project, ensuring its guidance is consistently applied.</p>
                <h2>The Power of Personas: Use Cases</h2>
                <p>A well-crafted persona can save you a significant amount of time on refinement by aligning the AI's initial output more closely with your specific requirements.</p>
                <h3>1. Enforcing a Design Style</h3>
                <p>You can use the persona to dictate a specific aesthetic. This is far more efficient than specifying the style in every single prompt.</p>
                <pre><code>// Persona for a minimalist designer:
"You are a world-class minimalist web designer with a passion for brutalist architecture. You prioritize clean lines, generous whitespace, and a monochromatic color palette. You exclusively use sans-serif fonts and avoid any unnecessary visual flair like gradients or drop shadows."</code></pre>
                <h3>2. Defining a Brand Voice</h3>
                <p>The persona can also guide the AI's copywriting, ensuring the generated text matches your brand's tone.</p>
                <pre><code>// Persona for a playful, youthful brand:
"You are a copywriter for a Gen-Z-focused startup. Your tone is playful, energetic, and full of slang and emojis. You keep sentences short and punchy. Avoid corporate jargon at all costs. 🚀"</code></pre>
                <h3>3. Specifying Technical Constraints</h3>
                <p>For developers, the persona can be used to enforce specific coding standards or technologies.</p>
                <pre><code>// Persona for a developer focused on accessibility:
"You are an accessibility (a11y) expert. Every piece of HTML you write must be fully compliant with WCAG 2.1 AA standards. Ensure all images have descriptive alt tags, all interactive elements are keyboard-navigable, and ARIA roles are used where appropriate. You never use positive tabindex values."</code></pre>
                <h3>4. Role-Playing for Niche Industries</h3>
                <p>You can have the AI adopt the mindset of an expert in a specific field to generate more authentic and knowledgeable content.</p>
                <pre><code>// Persona for a real estate website:
"You are a luxury real estate agent with 20 years of experience. Your language is sophisticated and evocative, focusing on lifestyle and exclusivity. When describing properties, you highlight architectural details, premium materials, and unique amenities."</code></pre>
                <h2>Tips for Writing Effective Personas</h2>
                <ul>
                    <li><strong>Be Clear and Concise:</strong> While you can be detailed, get to the point. The most important instructions should come first.</li>
                    <li><strong>Use "You Are" Statements:</strong> Frame your instructions as if you are directly addressing the AI (e.g., "You are a developer," "You prioritize...").</li>
                    <li><strong>Combine Multiple Roles:</strong> Don't be afraid to mix and match. A persona can be both a designer and a copywriter (e.g., "You are a minimalist designer and a witty copywriter...").</li>
                    <li><strong>Experiment:</strong> The best way to learn is to try different personas and see how they affect the AI's output. Save personas that work well for you in a separate document to reuse in future projects.</li>
                </ul>
                <p>The AI Persona is a force multiplier for your prompts, allowing you to establish a consistent creative and technical foundation for your entire project with just a few sentences.</p>
            ` 
        },
        'exporting-code': { 
            title: 'Exporting Your Code', 
            content: `
                <h1>Exporting Your Code</h1>
                <p>Stylo AI gives you full ownership of your creations. You can export your entire project at any time, giving you the freedom to host it anywhere, integrate it with a custom backend, or store it in your own version control system.</p>
                
                <h2>How to Export</h2>
                <p>The export functionality is located within the multi-file IDE.</p>
                <ol>
                    <li>Load the project you wish to export.</li>
                    <li>Click the <strong>&lt;i class="fas fa-code"&gt;&lt;/i&gt; Code Editor</strong> button in the header toolbar to open the IDE.</li>
                    <li>In the IDE's action bar, click the <strong>&lt;i class="fas fa-download"&gt;&lt;/i&gt; Download</strong> button.</li>
                </ol>
                <p>Stylo AI will generate a clean, organized ZIP archive containing all the files from your project's file explorer (<code>index.html</code>, <code>style.css</code>, etc.). This package is a standard, self-contained static website that you can deploy on any web host or continue developing locally in an editor like VS Code.</p>
                <p><strong>Note:</strong> Code Export is a premium feature available on our paid plans.</p>
            ` 
        },
       'troubleshooting': { 
            title: 'Troubleshooting Common Issues', 
            content: `
                <h1>Troubleshooting Common Issues</h1>
                <p>While we strive to make Stylo AI a seamless experience, you may occasionally encounter unexpected behavior. This guide covers some of the most common issues and their solutions. The first and most important step is always to check your browser's Developer Console (F12 or Ctrl+Shift+I) for any red error messages.</p>
                
                <h2>Issue: The AI's response is incomplete or doesn't follow instructions.</h2>
                <ul>
                    <li><strong>Try Rerunning the Prompt:</strong> Hover over your last prompt and click the <strong>&lt;i class="fas fa-sync-alt"&gt;&lt;/i&gt; "Rerun"</strong> icon. A second attempt will often produce a correct result.</li>
                    <li><strong>Rephrase Your Prompt:</strong> Be more specific or break down a complex command into smaller steps.</li>
                    <li><strong>Use the "Ask AI" Panel:</strong> If the "Create" AI is struggling with a specific code issue, switch to the "Ask AI" panel and ask for a targeted fix.</li>
                    <li><strong>Restore a Previous Version:</strong> Use <strong>&lt;i class="fas fa-history"&gt;&lt;/i&gt; Version History</strong> to revert to the last known good state.</li>
                </ul>
                
                <h2>Issue: The website preview is blank or styles are not working.</h2>
                <ul>
                    <li><strong>Check the Console for Errors:</strong> JavaScript errors can stop the page from rendering. Use the "Ask AI" panel to help debug them.</li>
                    <li><strong>Hard Refresh:</strong> Press <strong>Ctrl+Shift+R</strong> (or <strong>Cmd+Shift+R</strong> on Mac) to perform a hard refresh and clear your browser's cache.</li>
                </ul>
                
                <h2>Issue: I can't sign in, or my projects aren't loading.</h2>
                <ul>
                    <li><strong>Check Your Internet Connection:</strong> Stylo AI requires an active internet connection.</li>
                    <li><strong>Clear Site Data:</strong> In your browser's Developer Tools, go to the "Application" tab, clear Local Storage and Cookies for our site, then refresh and sign in again.</li>
                </ul>
            ` 
        },
       /* 'api-keys': { 
            title: 'API Keys & Integrations', 
            content: `
                <h1>API Keys & Integrations</h1>
                <p>Stylo AI provides Personal Access Tokens (API Keys) for developers who wish to build custom integrations or automate workflows. This allows you to fetch data from your Stylo AI projects and display it on other websites, or even build custom tooling. Please handle your API keys with extreme care, as they grant read access to your project data.</p>
                
                <h2>Generating Your API Key</h2>
                <p>You can manage your API keys from your <strong>Profile Dashboard</strong>.</p>
                <ol>
                    <li>Navigate to the "API Keys" section.</li>
                    <li>Click the <strong>"Generate New Key"</strong> button. A new key will be created.</li>
                    <li><strong>Important:</strong> Copy the key immediately and store it in a secure location (like a password manager or a <code>.env</code> file). For security reasons, the full key will not be shown again.</li>
                </ol>
                
                <h2>Using the API</h2>
                <p>The Stylo AI API is a RESTful API that allows you to programmatically access your project resources. All endpoints are read-only for now to ensure data security.</p>

                <h3>1. Base URL</h3>
                <p>All API requests should be made to the following base URL:</p>
                <pre><code>https://styloai-beta.vercel.app/api</code></pre>

                <h3>2. Authentication</h3>
                <p>All requests must be authenticated by including your API key in the <code>Authorization</code> header as a Bearer Token. Remember to never expose this key on the client-side in a public project.</p>
                <pre><code>fetch('https://styloai-beta.vercel.app/api/projects', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY_HERE'
  }
});</code></pre>

                <h3>3. Available Endpoints</h3>
                <ul>
                    <li><strong>List Projects:</strong> <code>GET /projects</code><br>Returns an array of all projects you own or collaborate on.</li>
                    <li><strong>Get Project Details:</strong> <code>GET /projects/{projectId}</code><br>Returns the full details for a single project, including its HTML content and metadata.</li>
                    <li><strong>List Project Collections:</strong> <code>GET /projects/{projectId}/collections</code><br>Returns an array of all database collections within a specific project.</li>
                    <li><strong>Get Collection Submissions:</strong> <code>GET /projects/{projectId}/collections/{collectionId}/submissions</code><br>Returns an array of all form submissions (documents) within a specific database collection.</li>
                </ul>

                <h2>Tutorial: Fetching Projects in a Vanilla JS App</h2>
                <p>Here’s a practical example of how to fetch your Stylo AI projects and display them on a simple HTML page.</p>

                <h4>index.html</h4>
                <pre><code>&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;title&gt;My Stylo Projects&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;h1&gt;My Stylo AI Projects&lt;/h1&gt;
    &lt;ul id="projects-list"&gt;&lt;li&gt;Loading...&lt;/li&gt;&lt;/ul&gt;
    &lt;script src="app.js"&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;
</code></pre>

                <h4>app.js</h4>
                <pre><code>const apiKey = 'YOUR_API_KEY_HERE'; // Replace with your key
const projectsList = document.getElementById('projects-list');

async function fetchProjects() {
  try {
    const response = await fetch('https://styloai-beta.vercel.app/api/projects', {
      headers: { 'Authorization': \`Bearer \${apiKey}\` }
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.statusText}\`);
    }

    const projects = await response.json();
    
    projectsList.innerHTML = projects.map(project => 
      \`&lt;li&gt;
        &lt;strong&gt;\${project.name}&lt;/strong&gt; - &lt;a href="\${project.deploymentUrl || '#'}" target="_blank"&gt;Visit&lt;/a&gt;
      &lt;/li&gt;\`
    ).join('');

  } catch (error) {
    projectsList.innerHTML = \`&lt;li style="color: red;"&gt;\${error.message}&lt;/li&gt;\`;
  }
}

fetchProjects();
</code></pre>

                <h2>Helper Library: <code>api.js</code></h2>
                <p>To make integrations even easier, we provide a simple helper library. You can save this code as <code>api.js</code> in your project to simplify your fetch requests.</p>

                <pre><code>// File: /api/api.js

const STYLO_API_BASE = 'https://styloai-beta.vercel.app/api';

async function styloFetch(endpoint, apiKey) {
  const url = \`\${STYLO_API_BASE}\${endpoint}\`;
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': \`Bearer \${apiKey}\` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || \`API request failed with status \${response.status}\`);
    }
    return response.json();
  } catch (error) {
    console.error(\`Stylo API Error fetching \${endpoint}:\`, error);
    throw error;
  }
}

// Fetches all your projects
export function getStyloProjects(apiKey) {
  return styloFetch('/projects', apiKey);
}

// Fetches a single project's details
export function getStyloProjectById(apiKey, projectId) {
  return styloFetch(\`/projects/\${projectId}\`, apiKey);
}

// Fetches submissions from a project's database collection
export function getStyloCollectionData(apiKey, projectId, collectionId) {
  return styloFetch(\`/projects/\${projectId}/collections/\${collectionId}/submissions\`, apiKey);
}
</code></pre>

                <h3>Using the <code>api.js</code> Library</h3>
                <p>With the helper library, your code becomes much cleaner. Make sure to use <code>&lt;script type="module"&gt;</code> in your HTML.</p>

                <h4>index.html (updated)</h4>
                <pre><code>&lt;!-- ... same as before ... --&gt;
&lt;script type="module" src="app.js"&gt;&lt;/script&gt;
&lt;!-- ... same as before ... --&gt;
</code></pre>

                <h4>app.js (with helper library)</h4>
                <pre><code>import { getStyloProjects } from './api/api.js';

const apiKey = 'YOUR_API_KEY_HERE';
const projectsList = document.getElementById('projects-list');

async function displayProjects() {
  try {
    const projects = await getStyloProjects(apiKey);
    projectsList.innerHTML = projects.map(p => \`&lt;li&gt;\${p.name}&lt;/li&gt;\`).join('');
  } catch (error) {
    projectsList.innerHTML = \`&lt;li style="color: red;"&gt;\${error.message}&lt;/li&gt;\`;
  }
}

displayProjects();
</code></pre>
            ` 
        }, */
        'security-best-practices': { 
            title: 'Security Best Practices', 
            content: `
                <h1>Security Best Practices</h1>
                <p>At Stylo AI, we take the security of your account and your data very seriously. Our platform is built on Google's secure Firebase infrastructure. However, security is a shared responsibility.</p>
                
                <h2>Account Security</h2>
                <ul>
                    <li><strong>Secure Your Google/Email Account:</strong> Your account's security is tied to the email or Google account you use to sign in. We strongly recommend enabling <strong>Two-Factor Authentication (2FA)</strong> on that account.</li>
                    <li><strong>Beware of Phishing:</strong> We will never ask you for your password. Be cautious of emails asking for login credentials.</li>
                </ul>
                
                <h2>API Key Security</h2>
                <ul>
                    <li><strong>Never Share Keys Publicly:</strong> Do not commit keys to public Git repositories or paste them in public forums.</li>
                    <li><strong>Store Keys Securely:</strong> Use a password manager or environment variables. Do not store them in plain text files.</li>
                    <li><strong>Revoke Unused Keys:</strong> Periodically review and delete any API keys you are no longer using from your profile dashboard.</li>
                </ul>
                
                <h2>Collaboration Security</h2>
                <ul>
                    <li><strong>Use the Principle of Least Privilege:</strong> When inviting collaborators, assign them the role with the minimum level of permission they need to do their job (e.g., "Viewer" instead of "Editor" for clients).</li>
                    <li><strong>Regularly Review Collaborators:</strong> Remove access for team members who no longer work on a project.</li>
                </ul>
            ` 
        },
        'terms-and-conditions': {
            title: 'Terms & Conditions',
            content: `
                <h1>Terms and Conditions</h1>
                <p>Last updated: Nov 30, 2025</p>
                <p>Please read these terms and conditions carefully before using the Stylo AI service ("the Service") operated by MD Colab ("us", "we", or "our"). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.</p>
                
                <h2>1. Acceptance of Terms</h2>
                <p>By accessing and using Stylo AI, you accept and agree to be bound by these Terms. If you do not agree to abide by these terms, please do not use this service. This agreement is effective as of the date you first use the Service.</p>
                
                <h2>2. Description of Service</h2>
                <p>The Service is an AI-powered web development platform that allows users to generate, edit, collaborate on, and deploy websites. Functionalities include but are not limited to AI-driven code generation, a multi-file IDE, a visual editor, project and team management ("Workspaces"), and web hosting. The Service is provided "as is," and we assume no responsibility for the timeliness, deletion, or failure to store user data or content. We reserve the right to modify or discontinue the Service at any time.</p>
                
                <h2>3. Subscriptions and Payments</h2>
                <p>The Service offers both free and paid subscription plans ("Plans"). Access to certain features, functionalities, and resource limits (e.g., number of projects, team members, deployments) is determined by your current Plan. By purchasing a Plan, you agree to pay the specified fees, which will be billed on a recurring basis. All payments are handled by our third-party payment processor (Razorpay). We do not store your credit card information. Failure to pay may result in the suspension or termination of your paid Plan and a downgrade to the free tier, which may result in the loss of access to features and data exceeding the free tier limits.</p>

                <h2>4. User-Generated Content & Ownership</h2>
                <p>You are solely responsible for all code, text, images, and other content that you generate, upload, or provide to the Service ("User Content"). <strong>You retain full ownership and all intellectual property rights to the final HTML, CSS, and JavaScript code of the websites you create.</strong> We claim no ownership over your creative output.</p>
                <p>You grant us a limited, worldwide, royalty-free license to host, display, and use your User Content solely for the purpose of operating, providing, and improving the Service. This license terminates when you delete your content or your account.</p>

                <h2>5. Collaboration and Workspaces</h2>
                <p>When you create a Workspace or share a project, you are granting other users access to your User Content. You are responsible for managing member roles and permissions. As a project or Workspace owner, you acknowledge that invited members with "Editor" or "Owner" roles will have the ability to modify or delete the User Content within that shared environment. We are not responsible for actions taken by users you invite.</p>

                <h2>6. User Conduct and Responsibilities</h2>
                <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account, including the actions of any team members you invite. You must not use the Service for any illegal or unauthorized purpose. We reserve the right to terminate accounts that are found to be abusing the Service or creating unlawful content.</p>
                
                <h2>7. Termination</h2>
                <p>We may terminate or suspend your access to the Service immediately for any breach of these Terms. Upon termination, your right to use the Service will cease. If you wish to terminate your account, you may do so from your profile settings. If an owner's account is terminated, any Workspaces or projects owned by that account may become inaccessible to other collaborators.</p>
                
                <h2>8. Disclaimer of Warranties</h2>
                <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, whether express or implied, including but not limited to fitness for a particular purpose and non-infringement. We do not warrant that the service will be uninterrupted, secure, or error-free.</p>
                
                <h2>9. Limitation of Liability</h2>
                <p>In no event shall MD Colab, its directors, or employees be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, or goodwill, resulting from your use of the Service or the conduct of any third party on the Service.</p>
                
                <h2>10. Changes to Terms</h2>
                <p>We reserve the right to modify these Terms at any time. We will provide at least 30 days' notice of any material changes. By continuing to use the Service after revisions become effective, you agree to be bound by the revised terms.</p>
            `
        },
        'privacy-policy': {
            title: 'Privacy Policy',
            content: `
                <h1>Privacy Policy</h1>
                <p>Last updated: Nov 30, 2025</p>
                <p>This Privacy Policy describes our policies on the collection, use, and disclosure of your information when you use Stylo AI ("the Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
                
                <h2>1. Information We Collect</h2>
                <p>We collect information you provide directly, information generated through your use of the Service, and information from third parties.</p>
                <ul>
                    <li><strong>Personal Profile Information:</strong> When you register, we collect your name, email address, and profile picture from your authentication provider. You may voluntarily provide additional profile information such as a bio, professional title, website, location, age, and gender.</li>
                    <li><strong>User Content:</strong> We collect and store all data related to your projects, including AI prompts, generated code (HTML, CSS, JS), project names, and any files (images, documents, etc.) you upload. This also includes data you or your users submit to your project databases (collections).</li>
                    <li><strong>Collaboration Data:</strong> We collect information related to team activities, including Workspace names, members you invite (their email addresses), roles you assign, and project sharing history.</li>
                    <li><strong>Payment Information:</strong> When you subscribe to a paid plan, our third-party payment processor (Razorpay) will collect your payment information. We do not store your credit card details but may receive transaction data such as your plan type and subscription status.</li>
                    <li><strong>Usage Data:</strong> We automatically collect technical data about your interactions with our Service, including your IP address, browser type, and pages visited, to help us improve our platform.</li>
                </ul>
                
                <h2>2. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul>
                    <li>Provide, operate, and maintain the Service;</li>
                    <li>Process your subscription payments and enforce plan limits;</li>
                    <li>Manage your account, projects, and team Workspaces;</li>
                    <li>Improve and personalize the Service. Your prompts and generated code may be used to train our AI models, but we take steps to anonymize this data where feasible;</li>
                    <li>Communicate with you regarding service updates, security alerts, and support matters;</li>
                    <li>Prevent fraud and ensure the security of our platform.</li>
                </ul>
                
                <h2>3. Information Sharing and Disclosure</h2>
                <p>We do not sell your personal information. We may share your information in the following limited circumstances:</p>
                <ul>
                    <li><strong>With Other Users (Collaboration):</strong> When you create or join a Workspace or share a project, your profile information (name, email, avatar) will be visible to other members of that Workspace or project to facilitate collaboration.</li>
                    <li><strong>With Service Providers:</strong> We share information with trusted third-party vendors who perform services on our behalf, such as payment processing (Razorpay), cloud hosting (Google Firebase), and AI model providers. These providers are contractually obligated to protect your data.</li>
                    <li><strong>For Legal Reasons:</strong> We may disclose your information if required by law or in response to valid requests by public authorities.</li>
                    <li><strong>During Business Transfers:</strong> Your information may be transferred in the event of a merger, acquisition, or asset sale.</li>
                </ul>
                
                <h2>4. Data Storage and Security</h2>
                <p>Your data is stored securely on Google Firebase servers. We implement industry-standard security measures to protect your information. However, no method of transmission or storage is 100% secure. You are responsible for the security of your account credentials and for managing the access rights of collaborators you invite.</p>
                
                <h2>5. Your Data Protection Rights</h2>
                <p>You have rights over your personal data. From your account settings, you can:</p>
                <ul>
                    <li><strong>Access and Rectify:</strong> View and update your profile information at any time.</li>
                    <li><strong>Export:</strong> You have the right to export the code of the websites you create, as permitted by your subscription plan.</li>
                    <li><strong>Erasure:</strong> You can permanently delete your account and all associated data from your account settings page. This action is irreversible.</li>
                </ul>
                
                <h2>6. Children's Privacy</h2>
                <p>Our Service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13.</p>
                
                <h2>7. Changes to This Privacy Policy</h2>
                <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or through a notice on the Service. We encourage you to review this policy periodically.</p>
            `
        }
    };

    // =========================================================================
    //  CORE APPLICATION LOGIC
    // =========================================================================

    /**
     * Renders a specific page's content into the main content area.
     * @param {string} pageId - The key of the page in the `pages` object.
     */
    const renderPage = (pageId) => {
        const page = pages[pageId] || pages['introduction']; // Default to intro page
        if (!page) {
            contentArea.innerHTML = `<h1>Page Not Found</h1><p>The documentation page you requested could not be found.</p>`;
            return;
        }

        contentArea.innerHTML = `
            <article class="content-page" id="${pageId}-content">
                ${page.content}
            </article>
        `;
        
        updateActiveLink(pageId);
        addCopyButtonsToCodeBlocks();
        contentArea.scrollTo(0, 0); // Scroll to top on new page load
    };

    /**
     * Updates the active state of the sidebar navigation links.
     * @param {string} pageId - The ID of the currently active page.
     */
    const updateActiveLink = (pageId) => {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.hash === `#${pageId}`);
        });
    };

    /**
     * Finds all <pre> blocks and adds a "Copy" button to them.
     */
    const addCopyButtonsToCodeBlocks = () => {
        const codeBlocks = contentArea.querySelectorAll('pre');
        codeBlocks.forEach(block => {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = 'Copy';
            block.appendChild(btn);

            btn.addEventListener('click', () => {
                const code = block.querySelector('code').innerText;
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                }).catch(err => {
                    console.error('Failed to copy code:', err);
                    btn.textContent = 'Error';
                });
            });
        });
    };

    /**
     * Handles hash changes in the URL to navigate between pages.
     */
    const handleHashChange = () => {
        const pageId = window.location.hash.substring(1) || 'introduction';
        renderPage(pageId);
    };

    /**
     * Filters the sidebar navigation based on the search input.
     */
    const handleSearch = () => {
        const query = searchInput.value.toLowerCase();
        document.querySelectorAll('.nav-group').forEach(group => {
            let hasVisibleLink = false;
            group.querySelectorAll('.nav-link').forEach(link => {
                const text = link.textContent.toLowerCase();
                const isMatch = text.includes(query);
                link.parentElement.style.display = isMatch ? '' : 'none';
                if (isMatch) hasVisibleLink = true;
            });
            group.style.display = hasVisibleLink ? '' : 'none';
        });
    };

    /**
     * Sets the initial theme based on user preference or system settings.
     */
    const setInitialTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        
        document.body.setAttribute('data-theme', initialTheme);
        themeToggle.checked = initialTheme === 'dark';
    };
    
    // =========================================================================
    //  EVENT LISTENERS
    // =========================================================================

    // Navigate when a sidebar link is clicked
    sidebarNav.addEventListener('click', (e) => {
        if (e.target.matches('.nav-link')) {
            // For mobile, close the sidebar after navigation
            if (sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Handle page navigation on hash change
    window.addEventListener('hashchange', handleHashChange);

    // Handle theme switching
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // Handle sidebar search
    searchInput.addEventListener('input', handleSearch);

    // Handle mobile navigation toggle
    mobileNavToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close mobile nav if clicking outside of it
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileNavToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });


    // =========================================================================
    //  INITIALIZATION
    // =========================================================================
    
    setInitialTheme();
    handleHashChange(); // Load the initial page based on the URL hash
});