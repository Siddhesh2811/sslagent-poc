export function generateCnf(fqdn, sanList = []) {
  const base = `
[ req ]
default_md = sha256
prompt = no
${sanList.length > 0 ? "req_extensions = v3_req" : ""}
distinguished_name = dn

[ dn ]
C = IN
ST = Maharashtra
L = Navi-Mumbai
O = RIL
OU = SAP BASIS
CN = ${fqdn}
`;

  if (sanList.length === 0) return base;

  const sanBlock = `
[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
${sanList.map((s, i) => `DNS.${i + 1} = ${s}`).join("\n")}
`;

  return base + sanBlock;
}
