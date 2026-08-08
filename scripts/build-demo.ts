import { ContentGenerator } from "../packages/content-ai/src/index.ts";
import { buildSite, DeployClient } from "../packages/deploy/src/index.ts";

async function main() {
  const gen = new ContentGenerator({ apiKey: process.env.DEEPSEEK_API_KEY ?? "" });

  console.log("=== GENERATING DEMO SITE CONTENT ===");
  const result = await gen.generate({
    businessName: "Vela Skin & Laser Studio",
    category: "medspa",
    socialProfiles: [],
    rawSocialData: `Business: Vela Skin & Laser Studio, medical aesthetics clinic in Cape Town, South Africa.
Services: Botox, dermal fillers, laser hair removal, chemical peels, microneedling, IV vitamin therapy.
Location: 12 Kloof Street, Gardens, Cape Town.
Reviews: "Best clinic in Cape Town, Dr Naidoo is phenomenal" (5 stars), "Friendly staff, amazing results" (5 stars).`,
  });

  const biz = result.business;
  console.log("Name:", biz.name);
  console.log("Blog posts:", biz.blog.length);

  console.log("\n=== BUILDING SITE ===");
  const built = await buildSite(biz);
  console.log(`Built ${Object.keys(built.files).length} files`);

  console.log("\n=== DEPLOYING TO NETLIFY ===");
  const deployer = new DeployClient({
    provider: "netlify",
    token: process.env.DEPLOY_TOKEN ?? "",
    siteName: "demo-vela-studio",
  });

  const deploy = await deployer.deploy({ files: built.files });
  console.log("LIVE URL:", deploy.url);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
