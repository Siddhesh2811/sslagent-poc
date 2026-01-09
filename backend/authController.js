import ActiveDirectory from 'activedirectory2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    url: process.env.LDAP_SERVER,
    baseDN: process.env.LDAP_BASE_DN,
    // Optional: Only used if we have a service account for searches.
    // If these are empty/undefined, the library will just hold the config.
    username: process.env.LDAP_USER,
    password: process.env.LDAP_PASSWORD,
};

const domainSuffix = process.env.LDAP_DOMAIN_SUFFIX || ''; // e.g. @ril.com

export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        console.log(`Attempting login for: ${username}`);

        // 1. Construct the UPN (User Principal Name)
        // If the user entered "bob", and we have a suffix, make it "bob@ril.com"
        // If they entered "bob@ril.com", we use it as is.
        const userPrincipalName = username.includes('@') ? username : `${username}${domainSuffix}`;

        console.log(`Trying Direct Bind for: ${userPrincipalName}`);

        // 2. Direct Authentication
        // Since we might not have a service account, we instantiate a FRESH instance 
        // validation that we can connect.
        const ad = new ActiveDirectory(config);

        ad.authenticate(userPrincipalName, password, function (err, auth) {
            if (err) {
                console.error('LDAP Auth Error:', err);
                if (err.name === 'InvalidCredentialsError') {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                return res.status(500).json({ message: 'LDAP Server Error' });
            }

            if (auth) {
                console.log('Authentication successful!');

                const token = jwt.sign(
                    { id: username, email: userPrincipalName },
                    process.env.JWT_SECRET || 'fallback_secret',
                    { expiresIn: '8h' }
                );

                return res.json({
                    message: 'Login successful',
                    token,
                    user: {
                        username: username,
                        email: userPrincipalName
                    }
                });
            } else {
                return res.status(401).json({ message: 'Authentication failed' });
            }
        });

    } catch (error) {
        console.error('Login Controller Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
