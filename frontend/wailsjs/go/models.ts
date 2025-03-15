export namespace main {
	
	export class DirectoryEntry {
	    name: string;
	    isDirectory: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DirectoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDirectory = source["isDirectory"];
	    }
	}
	export class GhostManifest {
	    id: string;
	    name: string;
	    version: string;
	    description: string;
	    author: string;
	    shortcut: string;
	    icon: string;
	
	    static createFrom(source: any = {}) {
	        return new GhostManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.shortcut = source["shortcut"];
	        this.icon = source["icon"];
	    }
	}
	export class MousePosition {
	    x: number;
	    y: number;
	
	    static createFrom(source: any = {}) {
	        return new MousePosition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	    }
	}
	export class PluginValidationResult {
	    pluginPath: string;
	    isValid: boolean;
	    hasManifest: boolean;
	    hasContent: boolean;
	    hasBackground: boolean;
	    hasIcon: boolean;
	    errors: string[];
	    manifest?: number[];
	
	    static createFrom(source: any = {}) {
	        return new PluginValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pluginPath = source["pluginPath"];
	        this.isValid = source["isValid"];
	        this.hasManifest = source["hasManifest"];
	        this.hasContent = source["hasContent"];
	        this.hasBackground = source["hasBackground"];
	        this.hasIcon = source["hasIcon"];
	        this.errors = source["errors"];
	        this.manifest = source["manifest"];
	    }
	}

}

