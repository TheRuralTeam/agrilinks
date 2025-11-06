import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import ProductCatalog from "@/components/ProductCatalog";
import OrderSystem from "@/components/OrderSystem";
import AboutUs from "@/components/AboutUs";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <HowItWorks />
      <ProductCatalog />
      <OrderSystem />
      <AboutUs />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
