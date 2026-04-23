// DEPRECATED — scratchpad, NOT loaded by any page.
// -----------------------------------------------------------------------------
// This file was an early prototype of the phylogenetic-tree visualisation.
// It is no longer referenced by any HTML page and is kept only for reference.
// Do not modify or load it.
//
// The current implementations are:
//   - js/phylogenetic-tree.js     — legacy renderer (still used by phylogenetic-tree.html)
//   - js/phylogenetic-tree-v2.js  — new chronogram renderer (used by phylogenetic-tree-v2.html)
//
// This file may be removed in a future cleanup once the v2 renderer cuts over.
// -----------------------------------------------------------------------------

// Interactive Phylogenetic Tree Visualization

class PhylogeneticTree {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = 800;
        this.margin = {top: 50, right: 120, bottom: 50, left: 120};
        this.nodeRadius = 5;
        this.zoomLevel = 1;
        this.panOffset = {x: 0, y: 0};
        
        this.initSVG();
        this.initZoomControls();
    }
    
    initSVG() {
        // This would create the SVG element and set up the basic structure
        // for the phylogenetic tree visualization
        console.log('Initializing SVG for phylogenetic tree');
    }
    
    initZoomControls() {
        // This would set up zoom and pan controls for the tree
        const zoomIn = document.createElement('button');
        zoomIn.className = 'zoom-control zoom-in';
        zoomIn.innerHTML = '+';
        zoomIn.addEventListener('click', () => this.zoom(1.2));
        
        const zoomOut = document.createElement('button');
        zoomOut.className = 'zoom-control zoom-out';
        zoomOut.innerHTML = '-';
        zoomOut.addEventListener('click', () => this.zoom(0.8));
        
        const resetView = document.createElement('button');
        resetView.className = 'zoom-control reset';
        resetView.innerHTML = 'Reset';
        resetView.addEventListener('click', () => this.resetView());
        
        const controls = document.createElement('div');
        controls.className = 'tree-controls';
        controls.appendChild(zoomIn);
        controls.appendChild(zoomOut);
        controls.appendChild(resetView);
        
        this.container.appendChild(controls);
    }
    
    loadData(data) {
        // This would process the phylogenetic data and prepare it for visualization
        this.treeData = data;
        this.renderTree();
    }
    
    renderTree() {
        console.log('Rendering phylogenetic tree with data');

        // Adjust the tree layout to ensure proper spacing
        const treemap = d3.tree()
            .size([this.height, this.width]) // Use height for vertical spread
            .separation((a, b) => {
                // Increase separation more for direct siblings than cousins at the same depth
                return a.parent === b.parent ? 2 : 1.5;
            });

        // Apply the layout to the data
        const root = d3.hierarchy(this.treeData);
        treemap(root);

        // Compute the new tree layout
        const nodes = root.descendants();
        const links = root.links();

        // Normalize for fixed-depth. Adjust distance between levels
        const nodeSpacingMultiplier = 180; // Adjust this value to increase/decrease horizontal spacing between levels
        nodes.forEach(d => { d.y = d.depth * nodeSpacingMultiplier; });

        // Create links
        const link = this.svg.selectAll('.link')
            .data(links)
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical()
                .x(d => d.x)
                .y(d => d.y));

        // Create nodes
        const node = this.svg.selectAll('.node')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        node.append('circle')
            .attr('r', this.nodeRadius);

        node.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13) // Position text left/right of node based on type
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.name)
            .call(this.wrapText, 180); // Wrap text to prevent overlap
    }

    wrapText(text, width) {
        text.each(function() {
            const text = d3.select(this);
            const words = text.text().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            const y = text.attr('y');
            const dy = parseFloat(text.attr('dy')) || 0;
            let tspan = text.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', `${dy}em`);

            while ((word = words.pop())) {
                line.push(word);
                tspan.text(line.join(' '));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(' '));
                    line = [word];
                    tspan = text.append('tspan').attr('x', 0).attr('y', y).attr('dy', `${++lineNumber * lineHeight + dy}em`).text(word);
                }
            }
        });
    }
    
    zoom(factor) {
        // This would handle zooming in and out of the tree
        this.zoomLevel *= factor;
        this.updateView();
    }
    
    pan(dx, dy) {
        // This would handle panning the tree view
        this.panOffset.x += dx;
        this.panOffset.y += dy;
        this.updateView();
    }
    
    resetView() {
        // This would reset the view to the default state
        this.zoomLevel = 1;
        this.panOffset = {x: 0, y: 0};
        this.updateView();
    }
    
    updateView() {
        // This would update the visualization based on zoom and pan
        console.log(`Updating view: zoom=${this.zoomLevel}, pan=(${this.panOffset.x}, ${this.panOffset.y})`);
    }
    
    highlightFamily(familyName) {
        // This would highlight a specific family in the tree
        console.log(`Highlighting family: ${familyName}`);
    }
    
    getRelatedFamilies(familyName) {
        // This would return families that are closely related to the specified family
        console.log(`Getting families related to: ${familyName}`);
        return ['Related Family 1', 'Related Family 2'];
    }
}

// Sample data structure for the phylogenetic tree
const sampleTreeData = {
    name: "Root",
    children: [
        {
            name: "Non-Flowering Plants",
            children: [
                {
                    name: "Bryophytes",
                    children: [
                        { name: "Mosses", scientific: "Bryophyta" },
                        { name: "Liverworts", scientific: "Marchantiophyta" },
                        { name: "Hornworts", scientific: "Anthocerotophyta" }
                    ]
                },
                {
                    name: "Pteridophytes",
                    children: [
                        { name: "Ferns", scientific: "Polypodiopsida" },
                        { name: "Horsetails", scientific: "Equisetopsida" },
                        { name: "Clubmosses", scientific: "Lycopodiopsida" }
                    ]
                },
                {
                    name: "Gymnosperms",
                    children: [
                        { name: "Conifers", scientific: "Pinopsida" },
                        { name: "Cycads", scientific: "Cycadopsida" },
                        { name: "Ginkgos", scientific: "Ginkgoopsida" },
                        { name: "Gnetophytes", scientific: "Gnetopsida" }
                    ]
                }
            ]
        },
        {
            name: "Flowering Plants (Angiosperms)",
            children: [
                {
                    name: "Magnoliids",
                    children: [
                        { name: "Magnolia Family", scientific: "Magnoliaceae" },
                        { name: "Laurel Family", scientific: "Lauraceae" }
                    ]
                },
                {
                    name: "Monocots",
                    children: [
                        { name: "Grass Family", scientific: "Poaceae" },
                        { name: "Orchid Family", scientific: "Orchidaceae" },
                        { name: "Lily Family", scientific: "Liliaceae" },
                        { name: "Palm Family", scientific: "Arecaceae" }
                    ]
                },
                {
                    name: "Eudicots",
                    children: [
                        {
                            name: "Rosids",
                            children: [
                                { name: "Rose Family", scientific: "Rosaceae" },
                                { name: "Legume Family", scientific: "Fabaceae" },
                                { name: "Mustard Family", scientific: "Brassicaceae" }
                            ]
                        },
                        {
                            name: "Asterids",
                            children: [
                                { name: "Sunflower Family", scientific: "Asteraceae" },
                                { name: "Mint Family", scientific: "Lamiaceae" },
                                { name: "Nightshade Family", scientific: "Solanaceae" }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

// This would be initialized when the phylogenetic tree page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('phylogenetic-tree')) {
        const tree = new PhylogeneticTree('phylogenetic-tree');
        tree.loadData(sampleTreeData);
        
        // Example of adding interactivity
        const searchInput = document.getElementById('family-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                // This would filter and highlight families matching the search term
                console.log(`Searching for: ${searchTerm}`);
            });
        }
        
        // Example of filter controls
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filterType = this.dataset.filter;
                // This would filter the tree based on the selected filter
                console.log(`Filtering by: ${filterType}`);
            });
        });
    }
});
