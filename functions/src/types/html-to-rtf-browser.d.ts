declare module "html-to-rtf-browser" {
  const htmlToRtf: {
    convertHtmlToRtf(html: string): string;
  };
  export default htmlToRtf;
}
declare module "rtf-converter" {
  // rtf-converter exports a function named rtf_to_txt in the package you installed.
  // We only type what we use.
  export function rtf_to_txt(rtf: string): string;
}