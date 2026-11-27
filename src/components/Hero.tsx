import HeroBanner from "./landing/HeroBanner";
import FeaturesGrid from "./landing/FeaturesGrid";
import ChallengeSection from "./landing/ChallengeSection";
import SectorsSection from "./landing/SectorsSection";
import WhyChooseSection from "./landing/WhyChooseSection";
import TargetAudience from "./landing/TargetAudience";
import VisionSection from "./landing/VisionSection";

const Hero = () => {
  return (
    <>
      <HeroBanner />
      <FeaturesGrid />
      <ChallengeSection />
      <SectorsSection />
      <WhyChooseSection />
      <TargetAudience />
      <VisionSection />
    </>
  );
};

export default Hero;
