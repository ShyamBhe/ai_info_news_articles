// [slug, English, Nepali]
export const MENU = [
  { slug: 'about-ai', en: 'About AI', ne: 'एआईको बारेमा', kids: [['what-is-ai','What is AI?','एआई भनेको के हो?'],['machine-learning','Machine Learning','मेसिन लर्निङ'],['deep-learning','Deep Learning','डिप लर्निङ'],['generative-ai','Generative AI & LLMs','जेनेरेटिभ एआई'],['history-of-ai','History of AI','एआईको इतिहास'],['ai-ethics','AI Ethics','एआई नैतिकता']] },
  { slug: 'news', en: 'News', ne: 'समाचार', kids: [['news-nepal','Nepal AI News','नेपाल एआई समाचार'],['news-world','World AI News','विश्व एआई समाचार'],['news-startups','Startups & Funding','स्टार्टअप'],['news-research','Research','अनुसन्धान']] },
  { slug: 'articles', en: 'Articles', ne: 'लेखहरू', kids: [['explainers','Explainers','व्याख्या'],['opinion','Opinion','विचार'],['tutorials','Tutorials','ट्यूटोरियल']] },
  { slug: 'vulnerabilities', en: 'Vulnerabilities', ne: 'जोखिम', kids: [['prompt-injection','Prompt Injection','प्रम्प्ट इन्जेक्सन'],['deepfakes','Deepfakes & Scams','डिपफेक र ठगी'],['ai-privacy','Data & Privacy','डेटा र गोपनीयता'],['model-security','Model Security','मोडल सुरक्षा']] },
  { slug: 'interviews', en: 'Interviews', ne: 'अन्तर्वार्ता', kids: [['int-developers','Developers','विकासकर्ता'],['int-founders','Founders','संस्थापक'],['int-researchers','Researchers','अनुसन्धानकर्ता']] },
  { slug: 'tools', en: 'AI Tools', ne: 'एआई टुल', kids: [['chatbots','Chatbots','च्याटबट'],['image-video','Image & Video','तस्बिर र भिडियो'],['coding-ai','Coding','कोडिङ'],['productivity','Productivity','उत्पादकत्व']] },
  { slug: 'ai-nepal', en: 'AI in Nepal', ne: 'नेपालमा एआई', kids: [['nepali-nlp','Nepali Language AI','नेपाली भाषा एआई'],['agri-ai','Agriculture','कृषि'],['fintech-ai','Fintech','फिनटेक'],['gov-ai','Government','सरकारी सेवा']] },
  { slug: 'education', en: 'Education', ne: 'शिक्षा', kids: [['learn-ai','Learn AI','एआई सिक्नुहोस्'],['careers','Careers','करियर']] },
  { slug: 'blog', en: 'Blog', ne: 'ब्लग', kids: [] },
];
export const FLAT = MENU.flatMap((m) => [{ slug: m.slug, en: m.en, ne: m.ne, parent: null }, ...m.kids.map(([slug, en, ne]) => ({ slug, en, ne, parent: m.slug }))]);
export const LEAVES = FLAT.filter((c) => !MENU.some((m) => m.slug === c.slug && m.kids.length));
export const label = (slug, lang) => FLAT.find((x) => x.slug === slug)?.[lang] || slug;
export const slugsOf = (slug) => { const m = MENU.find((x) => x.slug === slug); return m ? [m.slug, ...m.kids.map((k) => k[0])] : [slug]; };
export const parentOf = (slug) => FLAT.find((x) => x.slug === slug)?.parent || slug;
