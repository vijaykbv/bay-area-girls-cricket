import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">About Us</h1>
      <div className="mt-6 text-gray-700 space-y-5 leading-relaxed">
        <p className="text-lg">
          Bay Area Girls Cricket is dedicated to growing the sport of cricket among young women
          and girls in the San Francisco Bay Area. We believe cricket builds character, teamwork,
          and lifelong friendships.
        </p>
        <p>
          Our program welcomes players of all experience levels — from beginners picking up a bat
          for the first time to experienced players looking for competitive league play.
        </p>

        <div className="border-l-4 border-vv-violet pl-5 py-1 my-6">
          <h2 className="text-xl font-bold text-black mb-2">Our Mission</h2>
          <p>
            To create an inclusive, welcoming cricket community where girls and young women in the
            Bay Area can learn, compete, and thrive through the sport of cricket.
          </p>
        </div>

        <h2 className="text-xl font-bold text-black">Get Involved</h2>
        <p>
          Interested in joining, coaching, or volunteering? Reach out to us at{" "}
          <a
            href="mailto:info@bayareagirlscricket.com"
            className="text-vv-violet hover:text-vv-dark hover:underline font-medium"
          >
            info@bayareagirlscricket.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
