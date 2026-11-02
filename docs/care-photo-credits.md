# CARE SCENE photographs

The three CARE cards (excluding the existing work-from-home image) use photographs published under the Pexels free license. The images are fetched into the same-origin GitHub Pages artifact at release time and are not loaded from Pexels by production visitors.

- Urgent sitting: https://www.pexels.com/photo/babysitter-playing-with-children-at-home-5691816/ — Alex Green.
- Nursery pickup (parent-child hug): https://www.pexels.com/photo/a-mother-hugging-her-son-7971448/ — Helena Lopes.
- Sick child: https://www.pexels.com/photo/a-mother-caring-for-her-sick-daughter-8376257/ — Tima Miroshnichenko.

Usage: https://www.pexels.com/license/

The original photos must not be represented as actual MATE partners, customers, or contracted caregivers. They illustrate use cases only. Keep logos and identifying text out of image edits.

The implementation uses https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg for build-time fetching. The packaging script checks JPEG magic, size and source HTML marker, then rewrites the public index.html to first-party relative URLs. No user form calls or outbound marketing occur in this process.
