/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
	serverDependenciesToBundle: ['ssr-window'],
	ignoredRouteFiles: ['**/.*', '.*', '**/*.css', '**/*.css.map', '**/*.scss'],
	// appDirectory: "app",
	// assetsBuildDirectory: "public/build",
	// serverBuildPath: "build/index.js",
	// publicPath: "/build/",
};
