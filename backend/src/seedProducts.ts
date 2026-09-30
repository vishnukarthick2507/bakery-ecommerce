import dotenv from "dotenv";
import mongoose from "mongoose";
import { Product } from "./models/Product.js";

dotenv.config();

const seedProducts = [
  {
    name: "Classic Chocolate Cake",
    slug: "classic-chocolate-cake",
    description: "Rich chocolate cake layered with smooth chocolate cream.",
    price: 650,
    category: "Cakes",
    images: [],
    stock: 10,
    availability: "AVAILABLE",
    preparationTime: 120,
    active: true,
  },
  {
    name: "Red Velvet Cake",
    slug: "red-velvet-cake",
    description: "Soft red velvet cake with creamy cheese frosting.",
    price: 750,
    category: "Cakes",
    images: [],
    stock: 8,
    availability: "AVAILABLE",
    preparationTime: 150,
    active: true,
  },
  {
    name: "Black Forest Cake",
    slug: "black-forest-cake",
    description: "Chocolate sponge cake with whipped cream and cherries.",
    price: 700,
    category: "Cakes",
    images: [],
    stock: 8,
    availability: "AVAILABLE",
    preparationTime: 120,
    active: true,
  },
  {
    name: "Chocolate Brownie",
    slug: "chocolate-brownie",
    description: "Rich and fudgy chocolate brownie.",
    price: 120,
    category: "Brownies",
    images: [],
    stock: 25,
    availability: "AVAILABLE",
    preparationTime: 45,
    active: true,
  },
  {
    name: "Blueberry Cheesecake",
    slug: "blueberry-cheesecake",
    description: "Creamy cheesecake topped with blueberry compote.",
    price: 800,
    category: "Cheesecakes",
    images: [],
    stock: 6,
    availability: "AVAILABLE",
    preparationTime: 180,
    active: true,
  },
] as const;

const seed = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  await mongoose.connect(mongoURI);

  const slugs = seedProducts.map((product) => product.slug);
  await Product.deleteMany({ slug: { $in: [...slugs] } });

  const inserted = await Product.insertMany([...seedProducts]);
  console.log(`Inserted ${inserted.length} products`);

  await mongoose.connection.close();
};

seed().catch(async (error) => {
  console.error("Failed to seed products:", error);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
