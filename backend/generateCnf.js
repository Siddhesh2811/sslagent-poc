export function generateCnf(fqdn, sanList = []) {
  // Ensure we have an array
  let list = Array.isArray(sanList) ? sanList : [sanList];
  if (sanList instanceof Set) list = Array.from(sanList);

  // Ensure CN is in SAN list
  const distinctSan = new Set(list.flat()); // flatten in case of nested
  distinctSan.add(fqdn);
  const finalSanList = Array.from(distinctSan).filter(s => typeof s === 'string' && s.trim() !== '');

  const base = `
[ req ]
default_md = sha256
prompt = no
req_extensions = v3_req
distinguished_name = dn

[ dn ]
C = IN
ST = Maharashtra
L = Navi-Mumbai
O = RIL
OU = SAP BASIS
CN = ${fqdn}
`;

  const sanBlock = `
[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
${finalSanList.map((s, i) => `DNS.${i + 1} = ${s}`).join("\n")}
`;

  return base + sanBlock;
}
