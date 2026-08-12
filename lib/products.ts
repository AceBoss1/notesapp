export type Product = {
  title: string;
  description: string;
  price: string;
  originalPrice?: string;
  type: string;
  href: string;
  image: string;
  featured: boolean;
};

export const PRODUCTS: Product[] = [
  {
    title: "20 IT Niches to Explore (With or Without a University Degree)",
    description:
      "A free downloadable guide mapping out 20 career-ready IT niches you can enter regardless of your academic background. Perfect if you're exploring where to start or pivot in tech.",
    price: "Free",
    type: "Downloadable",
    href: "https://selar.com/78101t",
    image: "/images/shop/20-it-niches-to-be-explored.jpeg",
    featured: false,
  },
  {
    title: "MS-Excel — Beginner to Advanced Proficiency",
    description:
      "A comprehensive physical course taking you from complete beginner to advanced Excel proficiency. Covers formulas, pivot tables, data analysis, dashboards, and real-world business applications.",
    price: "$29.49",
    originalPrice: "$47.92",
    type: "Physical Course",
    href: "https://selar.com/89u90q",
    image: "/images/shop/ms-excel-beginner-to-advanced.jpg",
    featured: true,
  },
  {
    title: "Career Planning and Development",
    description:
      "A practical downloadable resource for professionals at any stage — whether you're just starting out, pivoting, or looking to level up. Covers goal-setting, skill mapping, and building a career you're proud of.",
    price: "$8",
    originalPrice: "$12",
    type: "Downloadable",
    href: "https://selar.com/208003",
    image: "/images/shop/career-planning-and-development.jpg",
    featured: false,
  },
];
