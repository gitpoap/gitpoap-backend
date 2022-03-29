FROM grafana/grafana

ENV GF_AUTH_DISABLE_LOGIN_FORM=true
ENV GF_AUTH_ANONYMOUS_ENABLED=true
ENV GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
ENV GF_SERVER_HTTP_PORT=9091

COPY ./grafana.yml /etc/grafana/provisioning/datasources/datasources.yml
