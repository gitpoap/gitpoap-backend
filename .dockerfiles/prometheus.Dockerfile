FROM prom/prometheus

ADD .dockerfiles/prometheus.yml /etc/prometheus
ADD prometheus/alert.yml /etc/prometheus
